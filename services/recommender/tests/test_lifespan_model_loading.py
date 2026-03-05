import asyncio
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
import pytest

from services.recommender import main

def test_lifespan_loads_model_and_exposes_state(monkeypatch) -> None:
    """
    This will test the loading of the model during the runtime of the keras model
    and ensure that the app state is correctly set with the model configuration and loaded model.
    """
    monkeypatch.setattr(
        main,
        "_build_model_config",
        lambda: {"path": "/tmp/model.keras", "version": "v42", "required": True},
    )
    monkeypatch.setattr(main, "_validate_model_config", lambda _: Path("/tmp/model.keras"))
    monkeypatch.setattr(main, "_load_model_manifest", lambda *_args, **_kwargs: SimpleNamespace(candidate_index_map_path="/tmp/candidate_map.json"))
    monkeypatch.setattr(main, "load_model", lambda path: {"loaded_from": path})
    monkeypatch.setattr(main, "load_candidate_index_map", lambda path: {1: 10})
    monkeypatch.setattr(main, "build_inference_service", lambda model, candidate_index_map=None: {"wrapped_model": model, "candidate_index_map": candidate_index_map})
    
    app = FastAPI()
    
    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_config["version"] == "v42"
            assert app.state.model_version == "v42"
            assert app.state.model_path == "/tmp/model.keras"
            assert app.state.model_manifest.candidate_index_map_path == "/tmp/candidate_map.json"
            assert app.state.model == {"loaded_from": "/tmp/model.keras"}
            assert app.state.candidate_index_map == {1: 10}
            assert app.state.inference_service == {"wrapped_model": {"loaded_from": "/tmp/model.keras"}, "candidate_index_map": {1: 10}}
            assert app.state.fallback_inference is not None  # Fallback inference should be set even when model is loaded
            assert app.state.metrics["recommend_requests_total"] == 0  # Metrics should be initialized
    asyncio.run(runner())

def test_lifespan_skips_model_loading_when_model_path_missing(monkeypatch) -> None:
    """
    This will test what happens when the model path is missing from the configuration. 
    Since the model is not required, 
    it should skip loading and set the model and inference service to None or rule-based.
    Args:
        monkeypatch (): Pytest fixture for monkeypatching functions and attributes during the test.

    Returns:
        None: This function does not return anything. It will raise assertions if the expected behavior is not met.
    """
    monkeypatch.setattr(
        main,
        "_build_model_config",
        lambda: {"path": "", "version": "dev", "required": False},
    )
    monkeypatch.setattr(main, "_validate_model_config", lambda _: None)
    monkeypatch.setattr(main, "_load_model_manifest", lambda *_args, **_kwargs: None)


    load_calls = []

    def _record_load(path: str):
        load_calls.append(path)
        return "unused"

    monkeypatch.setattr(main, "load_model", _record_load)
    monkeypatch.setattr(main, "load_candidate_index_map", lambda path: {99: 999})
    monkeypatch.setattr(main, "build_inference_service", lambda model, candidate_index_map=None: "rule-based" if model is None else "model-based")

    app = FastAPI()

    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_path is None
            assert app.state.model_manifest is None
            assert app.state.model is None
            assert app.state.candidate_index_map is None
            assert app.state.model_version == "dev"
            assert app.state.inference_service == "rule-based"
            assert app.state.fallback_inference == "rule-based"  # Fallback inference should be rule-based when model is not loaded
            assert app.state.metrics["recommend_fallback_total"] == 0  # Metrics should be initialized
    asyncio.run(runner())

    assert load_calls == []

def test_lifespan_continues_with_rule_based_when_optional_manifest_validation_fails(monkeypatch) -> None:
    """
    This test will check that the lifespan function will correctly continue with a rule-based
    inference service when the optional manifest validation fails.

    It will check that the model and candidate index map are set to None since the manifest loading failed
    and that the inference service and fallback inference are set to "rule-based" since the model is
    optional and the manifest loading failed.

    It will also check that the load_model function is not called since the manifest loading failed and the
    model is optional.
    """
    monkeypatch.setattr(
        main,
        "_build_model_config",
        lambda: {"path": "/tmp/model.keras", "version": "dev", "required": False, "manifest_path": ""},
    )
    monkeypatch.setattr(main, "_validate_model_config", lambda _: Path("/tmp/model.keras"))
    monkeypatch.setattr(main, "_load_model_manifest", lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("feature_schema_version mismatch")))
    
    load_calls = []
    
    def _record_load(path: str):
        load_calls.append(path)
        return {"loaded_from": path}
    
    monkeypatch.setattr(main, "load_model", _record_load)
    monkeypatch.setattr(main, "load_candidate_index_map", lambda path: {1: 100})
    monkeypatch.setattr(main, "build_inference_service", lambda model, candidate_index_map=None: "model-based" if model is not None else "rule-based")
    
    app = FastAPI()
    
    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_path is None  # Model path should be None due to manifest loading failure
            assert app.state.model_manifest is None  # Model manifest should be None due to loading failure
            assert app.state.model is None  # Model should be None since manifest loading failed and model is optional
            assert app.state.candidate_index_map is None  # Candidate index map should be None since manifest loading failed
            assert app.state.inference_service == "rule-based"  # Inference service should fall back to rule-based since manifest loading failed
            assert app.state.fallback_inference == "rule-based"  # Fallback inference should also be rule-based
    
    asyncio.run(runner())
    
    assert load_calls == []  # load_model should not be called since manifest loading failed and model is optional

def test_lifespan_raises_on_manifest_validation_failure_when_model_required(monkeypatch) -> None:
    
    """
    Test that FastAPI raises a RuntimeError if the model manifest validation fails when the model is required.
    This test checks that the model manifest validation fails when the model version does not match, and that
    the model is required, leading to a RuntimeError being raised.
    """
    monkeypatch.setattr(
        main,
        "_build_model_config",
        lambda: {"path": "/tmp/model.keras", "version": "v7", "required": True, "manifest_path": ""},
    )
    monkeypatch.setattr(main, "_validate_model_config", lambda _: Path("/tmp/model.keras"))
    monkeypatch.setattr(main, "_load_model_manifest", lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("model_version mismatch")))
    monkeypatch.setattr(main, "load_model", lambda path: {"loaded_from": path})
    monkeypatch.setattr(main, "build_inference_service", lambda model, candidate_index_map=None: "model-based")

    app = FastAPI()

    async def runner() -> None:
        async with main.lifespan(app):
            return None

    with pytest.raises(RuntimeError, match="Model startup validation failed: model_version mismatch"):
        asyncio.run(runner())