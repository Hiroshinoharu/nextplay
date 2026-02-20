from fastapi import HTTPException

from ..models.request import RecommendRequest, SimilarRequest

async def recommend(payload: RecommendRequest):
    """
    Placeholder recommendation engine.
    ML logic will be added later.
    """

    return {
        "message": "Recommendation placeholder response",
        "received": payload.dict()
    }

async def recommend_similar(item_id: int):
    """
    Placeholder for item-to-item recommendations.
    Returns dummy similar item IDs for now.
    """
    if item_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid item id")

    # Dummy logic; replace with real similarity search
    similar = [item_id + 1, item_id + 2, item_id + 3]
    return {
        "item_id": item_id,
        "similar_items": similar
    }

async def recommend_for_user(user_id: int):
    """
    Placeholder for user-based recommendations
    Returns deterministic game IDs for initial route wiring.
    Args:
        user_id (int): The ID of the user to generate recommendations for.
    """
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid user id")

    # Dummy logic; replace with real user-based recommendation algorithm
    recommended_games = [user_id * 10 + i for i in range(1, 6)]
    return {
        "user_id": user_id,
        "recommended_games": recommended_games,
        "strategy": "placeholder_user_based"
    }

async def recommend_similar_post(payload: SimilarRequest):
    if payload.item_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid item id")

    k = max(1, min(50, payload.top_k))
    similar = [payload.item_id + i for i in range(1, k + 1)]
    return {
        "item_id": payload.item_id,
        "top_k": k,
        "similar_items": similar,
        "filters": payload.filters or {}
    }
