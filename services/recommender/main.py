from contextlib import asynccontextmanager
import os
import uvicorn
import requests
from fastapi import FastAPI
from services.recommender.routes.routes import register_routes

def _service_url(env_key: str, default: str) -> str:
    return os.getenv(env_key, default).rstrip("/")

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.service_urls = {
        "user": _service_url("USER_SERVICE_URL", "http://user:8083"),
        "game": _service_url("GAME_SERVICE_URL", "http://game:8081"),
        "gateway": _service_url("GATEWAY_SERVICE_URL", "http://gateway:8084"),
    }
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
