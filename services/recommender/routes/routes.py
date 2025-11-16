from fastapi import FastAPI
from ..handlers.recommend import recommend
from ..models.request import RecommendRequest

def register_routes(app: FastAPI):

    @app.get("/health")
    async def health():
        return {"service": "recommender", "status" : "running"}

    # POST /recommend
    app.post("/recommend")(recommend)

    # GET /recommend/user/{user_id}
    app.get("/recommend/user/{user_id}")(lambda user_id: {
        "todo": f"Generate recommendations for user {user_id}"
    })