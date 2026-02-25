from contextlib import asynccontextmanager
import logging
from pathlib import Path
import os

from fastapi import FastAPI
import uvicorn
import requests

from services.recommender.models.inference import build_inference_service
from services.recommender.models.model_loader import load_model
from services.recommender.routes.routes import register_routes

logger = logging.getLogger(__name__)

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
    }


def _validate_model_config(model_config: dict[str, str | bool]) -> Path | None:
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
    app.state.model_path = (validated_model_path.as_posix() if validated_model_path else None)
    app.state.model = load_model(app.state.model_path) if app.state.model_path else None
    
    # The inference service will be model-based if the model was loaded successfully, or rule-based if the model is not required or failed to load. This allows the application to continue functioning with a fallback recommendation strategy even if the ML model is not available.
    app.state.inference_service = build_inference_service(app.state.model)
    app.state.fallback_inference = build_inference_service(None)  # Always have a fallback inference service available, even if the model is not loaded or required.
    
    # Backward-compatible alias used by existing route tests/handlers.
    app.state.inference = app.state.inference_service
    
    app.state.metrics = {
        "recommend_requests_total": 0,
        "recommend_fallback_total": 0,
        "recommend_latency_ms_total": 0.0,
        "recommend_latency_ms_max": 0.0,
    }
    
    session = requests.Session()
    session.mount(
        "http://", 
        requests.adapters.HTTPAdapter(pool_connections=50, pool_maxsize=50))
    app.state.http = session
    app.state.request_timeout = (2.0, 5.0)
    
    logger.info(
        "recommender.startup model_version=%s model_path=%s using_model=%s",
        app.state.model_version,
        app.state.model_path,
        app.state.model is not None,
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

register_routes(app)

@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("services.recommender.main:app", host="0.0.0.0", port=8082)
