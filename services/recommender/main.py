from contextlib import asynccontextmanager
import logging
from pathlib import Path
import os
import time
from uuid import uuid4

from fastapi import FastAPI
import requests
import uvicorn

from services.recommender.models.artifact_manifest import ArtifactManifest, load_artifact_manifest
from services.recommender.models.inference import build_inference_service
from services.recommender.models.model_loader import load_candidate_index_map, load_model
from services.recommender.routes.routes import register_routes

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s service=recommender %(message)s",
)


def _service_url(env_key: str, default: str) -> str:
    return os.getenv(env_key, default).rstrip("/")


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _build_model_config() -> dict[str, str | bool]:
    return {
        "path": os.getenv("MODEL_PATH", "").strip(),
        "version": os.getenv("MODEL_VERSION", "dev").strip() or "dev",
        "required": _bool_env("MODEL_REQUIRED", default=False),
        "manifest_path": os.getenv("MODEL_MANIFEST_PATH", "").strip(),
    }


def _validate_model_config(model_config: dict[str, str | bool]) -> Path | None:
    model_path = str(model_config["path"])
    required = bool(model_config["required"])

    if not model_path:
        if required:
            raise RuntimeError("MODEL_REQUIRED=true but MODEL_PATH is not set")
        return None

    resolved_path = Path(model_path).expanduser().resolve()
    if not resolved_path.exists():
        raise RuntimeError(f"MODEL_PATH does not exist: {resolved_path}")

    return resolved_path


def _resolve_manifest_path(model_config: dict[str, str | bool], validated_model_path: Path | None) -> str | None:
    manifest_path = str(model_config.get("manifest_path", "") or "").strip()
    if manifest_path:
        return Path(manifest_path).expanduser().resolve().as_posix()

    if validated_model_path is None:
        return None

    artifact_manifest_path = validated_model_path.with_name("artifact_manifest.json")
    if artifact_manifest_path.exists():
        return artifact_manifest_path.as_posix()

    return validated_model_path.with_suffix(".manifest.json").as_posix()


def _load_model_manifest(model_config: dict[str, str | bool], model_path: str | None) -> ArtifactManifest | None:
    manifest_path = _resolve_manifest_path(model_config, Path(model_path) if model_path else None)
    if not manifest_path:
        return None

    return load_artifact_manifest(
        manifest_path=manifest_path,
        model_path=model_path,
        expected_model_version=str(model_config["version"]),
    )


def _build_loaded_model_identity(app: FastAPI) -> dict[str, str | bool | None]:
    manifest = getattr(app.state, "model_manifest", None)
    configured_version = str(app.state.model_config.get("version", "dev"))
    loaded_version = manifest.model_version if manifest is not None else configured_version
    return {
        "configured_model_version": configured_version,
        "loaded_model_version": loaded_version,
        "feature_schema_version": manifest.feature_schema_version if manifest is not None else None,
        "dataset_hash": manifest.dataset_hash if manifest is not None else None,
        "git_commit": manifest.git_commit if manifest is not None else None,
        "manifest_path": getattr(app.state, "model_manifest_path", None),
        "model_path": getattr(app.state, "model_path", None),
        "using_model": app.state.model is not None,
        "model_load_failed": bool(getattr(app.state, "model_load_failed", False)),
        "model_load_failure_reason": getattr(app.state, "model_load_failure_reason", None),
    }


def _initialise_optional_model_state(app: FastAPI, validated_model_path: Path | None) -> None:
    model_required = bool(app.state.model_config["required"])
    app.state.model_path = validated_model_path.as_posix() if validated_model_path else None
    app.state.model_manifest_path = _resolve_manifest_path(app.state.model_config, validated_model_path)
    app.state.model_manifest = None
    app.state.model = None
    app.state.candidate_index_map = None
    app.state.model_load_failed = False
    app.state.model_load_failure_reason = None

    try:
        app.state.model_manifest = _load_model_manifest(app.state.model_config, app.state.model_path)
        if app.state.model_manifest is not None:
            app.state.model_version = app.state.model_manifest.model_version
        app.state.model = load_model(app.state.model_path) if app.state.model_path else None

        candidate_index_map_path = None
        if app.state.model_manifest is not None:
            candidate_index_map_path = app.state.model_manifest.candidate_index_map_path
            candidate_map = Path(candidate_index_map_path)
            if not candidate_map.is_absolute() and app.state.model_manifest_path is not None:
                candidate_map = (Path(app.state.model_manifest_path).resolve().parent / candidate_map).resolve()
            candidate_index_map_path = candidate_map.as_posix()

        app.state.candidate_index_map = (
            load_candidate_index_map(candidate_index_map_path) if candidate_index_map_path else None
        )
    except Exception as exc:
        if model_required:
            raise RuntimeError(f"Model startup validation failed: {exc}") from exc
        logger.warning(
            "Failed to load model or manifest, but MODEL_REQUIRED=false so continuing without model. Error: %s",
            exc,
        )
        app.state.model_load_failed = True
        app.state.model_load_failure_reason = str(exc)
        app.state.model_path = None
        app.state.model_manifest_path = None
        app.state.model_manifest = None
        app.state.model = None
        app.state.candidate_index_map = None

    app.state.loaded_model_identity = _build_loaded_model_identity(app)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.service_urls = {
        "user": _service_url("USER_SERVICE_URL", "http://user:8083"),
        "game": _service_url("GAME_SERVICE_URL", "http://game:8081"),
        "gateway": _service_url("GATEWAY_SERVICE_URL", "http://gateway:8084"),
    }

    app.state.model_config = _build_model_config()
    app.state.model_version = str(app.state.model_config["version"])

    validated_model_path = _validate_model_config(app.state.model_config)
    _initialise_optional_model_state(app, validated_model_path)

    app.state.inference_service = build_inference_service(app.state.model, app.state.candidate_index_map)
    app.state.fallback_inference = build_inference_service(None)
    app.state.inference = app.state.inference_service

    app.state.metrics = {
        "recommend_requests_total": 0,
        "recommend_fallback_total": 0,
        "recommend_errors_total": 0,
        "recommend_latency_ms_total": 0.0,
        "recommend_latency_ms_max": 0.0,
        "recommend_outcome_model_inference_success_total": 0,
        "recommend_outcome_model_inference_failure_with_fallback_total": 0,
        "recommend_outcome_fallback_only_mode_total": 0,
        "recommend_fallback_reason_load_failure_total": 0,
        "recommend_fallback_reason_no_model_loaded_total": 0,
        "recommend_fallback_reason_missing_inference_service_total": 0,
        "recommend_fallback_reason_inference_exception_total": 0,
        "recommend_fallback_reason_empty_candidates_total": 0,
        "recommend_fallback_reason_fallback_inference_exception_total": 0,
    }

    session = requests.Session()
    session.mount(
        "http://",
        requests.adapters.HTTPAdapter(pool_connections=50, pool_maxsize=50),
    )
    app.state.http = session
    app.state.request_timeout = (2.0, 5.0)

    identity = app.state.loaded_model_identity
    logger.info(
        "recommender.startup configured_model_version=%s loaded_model_version=%s dataset_hash=%s git_commit=%s manifest_path=%s model_path=%s using_model=%s model_load_failed=%s model_load_failure_reason=%s",
        identity["configured_model_version"],
        identity["loaded_model_version"],
        identity["dataset_hash"] or "none",
        identity["git_commit"] or "none",
        identity["manifest_path"] or "none",
        identity["model_path"] or "none",
        identity["using_model"],
        identity["model_load_failed"],
        identity["model_load_failure_reason"] or "none",
    )
    try:
        yield
    finally:
        app.state.http.close()


app = FastAPI(
    title="NextPlay Recommender Service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def access_log_with_request_id(request, call_next):
    request_id = request.headers.get("X-Request-ID", "").strip() or uuid4().hex
    request.state.request_id = request_id
    started = time.perf_counter()

    response = await call_next(request)
    latency_ms = (time.perf_counter() - started) * 1000

    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_id=%s method=%s path=%s status=%s latency_ms=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        latency_ms,
    )
    return response


register_routes(app)


if __name__ == "__main__":
    uvicorn.run("services.recommender.main:app", host="0.0.0.0", port=8082)
