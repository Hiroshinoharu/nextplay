from fastapi import FastAPI

from ..handlers.recommend import (
    recommend, 
    recommend_for_user, 
    recommend_similar, 
    recommend_similar_post)

from ..models.response import RecommendResponse, SimilarResponse, UserRecommendResponse

def register_routes(app: FastAPI):
    
    @app.get("/health")
    async def health():
        return {"service": "recommender", "status" : "running"}

    # POST /recommend
    app.post("/recommend", response_model=RecommendResponse)(recommend)

    # GET /recommend/user/{user_id}
    app.get("/recommend/user/{user_id}", response_model=UserRecommendResponse)(recommend_for_user)

    # GET /recommend/item/{item_id}
    app.get("/recommend/item/{item_id}", response_model=SimilarResponse)(recommend_similar)

    # POST /recommend/item
    app.post("/recommend/item", response_model=SimilarResponse)(recommend_similar_post)
