from fastapi import FastAPI
from services.recommender.routes.routes import register_routes

app = FastAPI(
    title="NextPlay Recommender Service",
    version="1.0.0"
)

register_routes(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.recommender.main:app", host="0.0.0.0", port=8082, reload=True)