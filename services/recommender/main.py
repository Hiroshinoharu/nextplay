from contextlib import asynccontextmanager
import logging
from pathlib import Path
import os
import time
from uuid import uuid4

from fastapi import FastAPI
import uvicorn
import requests

from services.recommender.models.artifact_manifest import ArtifactManifest, load_artifact_manifest
from services.recommender.models.inference import build_inference_service
from services.recommender.models.model_loader import load_model, load_candidate_index_map
from services.recommender.routes.routes import register_routes

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s service=recommender %(message)s",
)


def _service_url(env_key: str, default: str) -> str:
    """Helper function to get service URLs from environment variables with defaults."""
    return os.getenv(env_key, default).rstrip("/")


def _bool_env(name: str, default: bool = False) -> bool:
    """Helper function to parse boolean environment variables."""
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _build_model_config() -> dict[str, str | bool]:
    """Build the model configuration dictionary from environment variables, applying defaults as needed."""
    return {
        "path": os.getenv("MODEL_PATH", "").strip(),
        "version": os.getenv("MODEL_VERSION", "dev").strip() or "dev",
        "required": _bool_env("MODEL_REQUIRED", default=False),
        "manifest_path": os.getenv("MODEL_MANIFEST_PATH", "").strip(),
    }


def _validate_model_config(model_config: dict[str, str | bool]) -> Path | None:
    """
    Validate the model configuration and resolve the model file path.
    This function checks that required parameters are present in the model configuration
    and verifies that the specified model file exists when required.
    Args:
        model_config: A dictionary containing model configuration with keys:
            - "path" (str): The file path to the model, may be empty or use ~ for home directory
            - "required" (bool): Whether the model is required
    Returns:
        Path | None: The resolved absolute path to the model file if valid and present,
            or None if the model is not required and no path is specified
    Raises:
        RuntimeError: If the model is required but MODEL_PATH is not set
        RuntimeError: If the specified MODEL_PATH does not exist
    """
    """Validate the model configuration, ensuring that required parameters are present and that the specified model file exists if required. Returns the resolved model path if valid, or None if not required."""
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
    """Resolve explicit manifest path from config or derive a default alongside model file."""
    manifest_path = str(model_config.get("manifest_path", "") or "").strip()
    if manifest_path:
        return Path(manifest_path).expanduser().resolve().as_posix()

    if validated_model_path is None:
        return None

    return validated_model_path.with_suffix(".manifest.json").as_posix()

def _load_model_manifest(model_config: dict[str, str | bool], model_path: str | None) -> ArtifactManifest | None:
    """Load and validate model manifest metadata when a model is configured."""
    manifest_path = _resolve_manifest_path(model_config, Path(model_path) if model_path else None)
    if not manifest_path:
        return None

    return load_artifact_manifest(
        manifest_path=manifest_path,
        model_path=model_path,
        expected_model_version=str(model_config["version"]),
    )

def _initialise_optional_model_state(app: FastAPI, validated_model_path: Path | None) -> None:
    """
    Initialise the app's model state based on the validated model path.

    If the model is required but cannot be loaded, raise a RuntimeError.
    If the model is not required and cannot be loaded, log a warning and continue without the model.

    Sets app.state.model_path, app.state.model_manifest, app.state.model, and app.state.candidate_index_map accordingly.
    """
    model_required = bool(app.state.model_config["required"])
    app.state.model_path = validated_model_path.as_posix() if validated_model_path else None
    app.state.model_manifest = None
    app.state.model = None
    app.state.candidate_index_map = None
    app.state.model_load_failed = False
    app.state.model_load_failure_reason = None
    
    try:
        app.state.model_manifest = _load_model_manifest(app.state.model_config, app.state.model_path)
        app.state.model = load_model(app.state.model_path) if app.state.model_path else None
        
        candidate_index_map_path = None
        if app.state.model_manifest is not None:
            candidate_index_map_path = app.state.model_manifest.candidate_index_map_path
            candidate_map = Path(candidate_index_map_path)
            if not candidate_map.is_absolute():
                manifest_path = _resolve_manifest_path(app.state.model_config, validated_model_path)
                if manifest_path is not None:
                    candidate_map = (Path(manifest_path).resolve().parent / candidate_map).resolve()
            candidate_index_map_path = candidate_map.as_posix()

        app.state.candidate_index_map = (
            load_candidate_index_map(candidate_index_map_path) if candidate_index_map_path else None
        )
    except Exception as exc:
        if model_required:
            raise RuntimeError(f"Model startup validation failed: {exc}") from exc
        logger.warning(f"Failed to load model or manifest, but MODEL_REQUIRED=false so continuing without model. Error: {exc}")
        app.state.model_load_failed = True
        app.state.model_load_failure_reason = str(exc)
        app.state.model_path = None
        app.state.model_manifest = None
        app.state.model = None
        app.state.candidate_index_map = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan function to initialize application state, including loading the model and setting up the inference service. This function is called when the FastAPI app starts up and can be used to perform any necessary setup before handling requests.

    Args:
        app (FastAPI): The FastAPI application instance for which the lifespan is being defined. The app.state attribute can be used to store shared state that can be accessed by request handlers and other parts of the application.
    """
    app.state.service_urls = {
        "user": _service_url("USER_SERVICE_URL", "http://user:8083"),
        "game": _service_url("GAME_SERVICE_URL", "http://game:8081"),
        "gateway": _service_url("GATEWAY_SERVICE_URL", "http://gateway:8084"),
    }

    app.state.model_config = _build_model_config()
    app.state.model_version = str(app.state.model_config["version"])

    validated_model_path = _validate_model_config(app.state.model_config)
    
    _initialise_optional_model_state(app, validated_model_path)
    
    
    # The inference service will be model-based if the model was loaded successfully, or rule-based if the model is not required or failed to load. This allows the application to continue functioning with a fallback recommendation strategy even if the ML model is not available.
    app.state.inference_service = build_inference_service(app.state.model, app.state.candidate_index_map)
    app.state.fallback_inference = build_inference_service(None)  # Always have a fallback inference service available, even if the model is not loaded or required.
    
    # Backward-compatible alias used by existing route tests/handlers.
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
        requests.adapters.HTTPAdapter(pool_connections=50, pool_maxsize=50))
    app.state.http = session
    app.state.request_timeout = (2.0, 5.0)
    
    logger.info(
        "recommender.startup model_version=%s model_path=%s using_model=%s model_load_failed=%s model_load_failure_reason=%s",
        app.state.model_version,
        app.state.model_path,
        app.state.model is not None,
        app.state.model_load_failed,
        app.state.model_load_failure_reason or "none",
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

@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("services.recommender.main:app", host="0.0.0.0", port=8082)
