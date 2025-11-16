from fastapi import HTTPException
from ..models.request import RecommendRequest

async def recommend(payload: RecommendRequest):
    """
    Placeholder recommendation engine.
    ML logic will be added later.
    """

    return {
        "message": "Recommendation placeholder response",
        "received": payload.dict()
    }