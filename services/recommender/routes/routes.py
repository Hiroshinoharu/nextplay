from fastapi import FastAPI
from ..handlers.recommend import recommend, recommend_similar, recommend_similar_post
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

    # GET /recommend/item/{item_id}
    app.get("/recommend/item/{item_id}")(recommend_similar)

    # POST /recommend/item
    app.post("/recommend/item")(recommend_similar_post)
