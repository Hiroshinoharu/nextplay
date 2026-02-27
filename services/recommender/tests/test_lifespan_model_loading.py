import asyncio
from pathlib import Path

from fastapi import FastAPI

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
    monkeypatch.setattr(main, "_load_model_manifest", lambda *_args, **_kwargs: {"manifest": "ok"})
    monkeypatch.setattr(main, "load_model", lambda path: {"loaded_from": path})
    monkeypatch.setattr(main, "build_inference_service", lambda model: {"wrapped_model": model})
    
    app = FastAPI()
    
    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_config["version"] == "v42"
            assert app.state.model_version == "v42"
            assert app.state.model_path == "/tmp/model.keras"
            assert app.state.model_manifest == {"manifest": "ok"}
            assert app.state.model == {"loaded_from": "/tmp/model.keras"}
            assert app.state.inference_service == {"wrapped_model": {"loaded_from": "/tmp/model.keras"}}
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
    monkeypatch.setattr(main, "build_inference_service", lambda model: "rule-based" if model is None else "model-based")

    app = FastAPI()

    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_path is None
            assert app.state.model_manifest is None
            assert app.state.model is None
            assert app.state.model_version == "dev"
            assert app.state.inference_service == "rule-based"
            assert app.state.fallback_inference == "rule-based"  # Fallback inference should be rule-based when model is not loaded
            assert app.state.metrics["recommend_fallback_total"] == 0  # Metrics should be initialized
    asyncio.run(runner())

    assert load_calls == []