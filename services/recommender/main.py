from fastapi import FastAPI
from services.recommender.routes.routes import register_routes

app = FastAPI(
    title="NextPlay Recommender Service",
    version="1.0.0"
)

register_routes(app)

@app.get("/")
def health():
    return {"service": "recommender", "status": "running"}