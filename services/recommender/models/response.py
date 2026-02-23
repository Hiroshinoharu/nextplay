from typing import Any, Dict, List

from pydantic import BaseModel

from .request import RecommendRequest


class RecommendResponse(BaseModel):
    """
        Response model for recommendation results.

    Args:
        BaseModel (class): Pydantic base model for data validation and serialization.
    """
    message: str
    received: RecommendRequest


class UserRecommendResponse(BaseModel):
    """
    Response model for user-based recommendations.

    Args:
        BaseModel (class): Pydantic base model for data validation and serialization.
    """
    user_id: int
    recommended_games: List[int]
    strategy: str


class SimilarResponse(BaseModel):
    """
    Response model for the similar models

    Args:
        BaseModel (class): Pydantic base model for data validation and serialization.
    """
    item_id: int
    similar_items: List[int]
    top_k: int | None = None
    filters: Dict[str, Any] | None = None