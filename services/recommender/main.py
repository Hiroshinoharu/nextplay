from fastapi import FastAPI

app = FastAPI(
    title="NextPlay Recommender Service",
    version="1.0.0"
)

@app.get("/")
def health():
    return {"service": "recommender", "status": "running"}

# Import routes AFTER app is created
from routes.routes import register_routes
register_routes(app)