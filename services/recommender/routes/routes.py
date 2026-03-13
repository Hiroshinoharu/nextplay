from fastapi import FastAPI, Request

from ..handlers.recommend import (
    recommend,
    recommend_for_user,
    recommend_similar,
    recommend_similar_post,
)
from ..models.response import SimilarResponse, UserRecommendResponse


def register_routes(app: FastAPI):
    @app.get("/health")
    async def health(request: Request):
        return {
            "service": "recommender",
            "status": "running",
            "model": getattr(request.app.state, "loaded_model_identity", None),
        }

    app.post("/recommend", response_model=UserRecommendResponse)(recommend)
    app.get("/recommend/user/{user_id}", response_model=UserRecommendResponse)(recommend_for_user)
    app.get("/recommend/item/{item_id}", response_model=SimilarResponse)(recommend_similar)
    app.post("/recommend/item", response_model=SimilarResponse)(recommend_similar_post)
