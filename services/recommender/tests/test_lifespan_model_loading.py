import asyncio
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
import pytest

from services.recommender import main


def test_resolve_server_host_defaults_to_ipv4_wildcard(monkeypatch) -> None:
    monkeypatch.delenv("HOST", raising=False)
    assert main._resolve_server_host() == "0.0.0.0"


def test_resolve_server_port_defaults_and_handles_invalid_values(monkeypatch) -> None:
    monkeypatch.delenv("PORT", raising=False)
    assert main._resolve_server_port() == 8082

    monkeypatch.setenv("PORT", "not-a-port")
    assert main._resolve_server_port() == 8082

    monkeypatch.setenv("PORT", "9090")
    assert main._resolve_server_port() == 9090


def test_lifespan_loads_model_and_exposes_state(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "_build_model_config",
        lambda: {"path": "/tmp/model.keras", "version": "v42", "required": True},
    )
    monkeypatch.setattr(main, "_validate_model_config", lambda _: Path("/tmp/model.keras"))
    monkeypatch.setattr(
        main,
        "_load_model_manifest",
        lambda *_args, **_kwargs: SimpleNamespace(
            model_version="v42",
            feature_schema_version="recommender_feature_schema_v1",
            popularity_prior_path="/tmp/popularity_prior.json",
            dataset_hash="dataset-sha-123",
            git_commit="git-sha-456",
            candidate_index_map_path="/tmp/candidate_map.json",
        ),
    )
    monkeypatch.setattr(main, "load_model", lambda path: {"loaded_from": path})
    monkeypatch.setattr(main, "load_candidate_index_map", lambda path: {1: 10})
    monkeypatch.setattr(main, "load_popularity_prior_map", lambda path: {1: 1.0})
    monkeypatch.setattr(
        main,
        "build_inference_service",
        lambda model, candidate_index_map=None, popularity_prior_map=None: {
            "wrapped_model": model,
            "candidate_index_map": candidate_index_map,
            "popularity_prior_map": popularity_prior_map,
        },
    )

    app = FastAPI()

    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_config["version"] == "v42"
            assert app.state.model_version == "v42"
            assert app.state.model_path == "/tmp/model.keras"
            assert app.state.model_manifest_path.endswith("model.manifest.json")
            assert app.state.model_manifest.candidate_index_map_path == "/tmp/candidate_map.json"
            assert app.state.model == {"loaded_from": "/tmp/model.keras"}
            assert app.state.candidate_index_map == {1: 10}
            assert app.state.popularity_prior_map == {1: 1.0}
            assert app.state.inference_service == {
                "wrapped_model": {"loaded_from": "/tmp/model.keras"},
                "candidate_index_map": {1: 10},
                "popularity_prior_map": {1: 1.0},
            }
            assert app.state.fallback_inference is not None
            assert app.state.metrics["recommend_requests_total"] == 0
            assert app.state.loaded_model_identity == {
                "configured_model_version": "v42",
                "loaded_model_version": "v42",
                "feature_schema_version": "recommender_feature_schema_v1",
                "popularity_prior_path": "/tmp/popularity_prior.json",
                "dataset_hash": "dataset-sha-123",
                "git_commit": "git-sha-456",
                "manifest_path": "/tmp/model.manifest.json",
                "model_path": "/tmp/model.keras",
                "using_model": True,
                "model_load_failed": False,
                "model_load_failure_reason": None,
            }

    asyncio.run(runner())


def test_lifespan_skips_model_loading_when_model_path_missing(monkeypatch) -> None:
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
    monkeypatch.setattr(main, "load_popularity_prior_map", lambda path: {1: 1.0})
    monkeypatch.setattr(
        main,
        "build_inference_service",
        lambda model, candidate_index_map=None, popularity_prior_map=None: "rule-based" if model is None else "model-based",
    )

    app = FastAPI()

    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_path is None
            assert app.state.model_manifest_path is None
            assert app.state.model_manifest is None
            assert app.state.model is None
            assert app.state.candidate_index_map is None
            assert app.state.popularity_prior_map is None
            assert app.state.model_version == "dev"
            assert app.state.inference_service == "rule-based"
            assert app.state.fallback_inference == "rule-based"
            assert app.state.metrics["recommend_fallback_total"] == 0
            assert app.state.loaded_model_identity == {
                "configured_model_version": "dev",
                "loaded_model_version": "dev",
                "feature_schema_version": None,
                "popularity_prior_path": None,
                "dataset_hash": None,
                "git_commit": None,
                "manifest_path": None,
                "model_path": None,
                "using_model": False,
                "model_load_failed": False,
                "model_load_failure_reason": None,
            }

    asyncio.run(runner())

    assert load_calls == []


def test_lifespan_continues_with_rule_based_when_optional_manifest_validation_fails(monkeypatch) -> None:
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
    monkeypatch.setattr(main, "load_popularity_prior_map", lambda path: {1: 1.0})
    monkeypatch.setattr(
        main,
        "build_inference_service",
        lambda model, candidate_index_map=None, popularity_prior_map=None: "model-based" if model is not None else "rule-based",
    )

    app = FastAPI()

    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_path is None
            assert app.state.model_manifest_path is None
            assert app.state.model_manifest is None
            assert app.state.model is None
            assert app.state.candidate_index_map is None
            assert app.state.popularity_prior_map is None
            assert app.state.inference_service == "rule-based"
            assert app.state.fallback_inference == "rule-based"
            assert app.state.loaded_model_identity == {
                "configured_model_version": "dev",
                "loaded_model_version": "dev",
                "feature_schema_version": None,
                "popularity_prior_path": None,
                "dataset_hash": None,
                "git_commit": None,
                "manifest_path": None,
                "model_path": None,
                "using_model": False,
                "model_load_failed": True,
                "model_load_failure_reason": "feature_schema_version mismatch",
            }

    asyncio.run(runner())

    assert load_calls == []


def test_lifespan_raises_on_manifest_validation_failure_when_model_required(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "_build_model_config",
        lambda: {"path": "/tmp/model.keras", "version": "v7", "required": True, "manifest_path": ""},
    )
    monkeypatch.setattr(main, "_validate_model_config", lambda _: Path("/tmp/model.keras"))
    monkeypatch.setattr(main, "_load_model_manifest", lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("model_version mismatch")))
    monkeypatch.setattr(main, "load_model", lambda path: {"loaded_from": path})
    monkeypatch.setattr(
        main,
        "build_inference_service",
        lambda model, candidate_index_map=None, popularity_prior_map=None: "model-based",
    )

    app = FastAPI()

    async def runner() -> None:
        async with main.lifespan(app):
            return None

    with pytest.raises(RuntimeError, match="Model startup validation failed: model_version mismatch"):
        asyncio.run(runner())
