from contextlib import asynccontextmanager
from pathlib import Path
import os
import uvicorn
import requests
from fastapi import FastAPI

from services.recommender.models.inference import build_inference_service
from services.recommender.models.model_loader import load_model
from services.recommender.routes.routes import register_routes


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
    app.state.model_path = (
        validated_model_path.as_posix() if validated_model_path else None
    )
    app.state.model = load_model(app.state.model_path) if app.state.model_path else None
    app.state.inference_service = build_inference_service(app.state.model)
    # Backward-compatible alias used by existing route tests/handlers.
    app.state.inference = app.state.inference_service
    
    session = requests.Session()
    session.mount("http://", requests.adapters.HTTPAdapter(pool_connections=50, pool_maxsize=50))
    app.state.http = session
    app.state.request_timeout = (2.0, 5.0)
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
