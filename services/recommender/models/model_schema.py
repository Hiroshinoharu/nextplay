from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .request import RecommendRequest
from .response import UserRecommendResponse

class ModelInputSchema(BaseModel):
    """
    Normalized model input schema that can be used across different recommendation strategies.

    Args:
        BaseModel (class): The base Pydantic model class.
    """
    
    user_id : int | None = None
    liked_keyword_ids: list[int] = Field(default_factory=list)
    liked_platform_ids: list[int] = Field(default_factory=list)
    disliked_keyword_ids: list[int] = Field(default_factory=list)
    disliked_platform_ids: list[int] = Field(default_factory=list)
    questionnaire: dict[str, Any] = Field(default_factory=dict)
    
    @classmethod
    def from_recommend_request(cls, payload: RecommendRequest) -> ModelInputSchema:
        """
        Factory method to create a ModelInputSchema instance from a RecommendRequest.

        Args:
            payload (RecommendRequest): The incoming recommendation request.
            
        Returns:
            ModelInputSchema: An instance of ModelInputSchema populated with data from the request.
        """
        return cls(
            user_id=payload.user_id,
            liked_keyword_ids=list(payload.liked_keywords),
            liked_platform_ids=list(payload.liked_platforms),
            disliked_keyword_ids=list(payload.disliked_keywords),
            disliked_platform_ids=list(payload.disliked_platforms),
            questionnaire=dict(payload.questionnaire or {}),
        )

class ModelCandidateScore(BaseModel):
    """
    Schema for representing a candidate item and its associated score.

    Args:
        BaseModel (class): The base Pydantic model class.
    """
    
    game_id: int
    score: float = 0.0
    rank: int = 1
    reason: str | None = None


class ModelOutputSchema(BaseModel):
    """
    Normalized model output used to create API responses.
    
    Args:
        BaseModel (class): The base Pydantic model class.
    """

    user_id: int | None = None
    strategy: str
    candidates: list[ModelCandidateScore] = Field(default_factory=list)

    def to_user_recommend_response(self, *, fallback_user_id: int | None = None) -> UserRecommendResponse:
        resolved_user_id = self.user_id if self.user_id is not None else fallback_user_id
        if resolved_user_id is None:
            raise ValueError("user_id is required to build UserRecommendResponse")

        return UserRecommendResponse(
            user_id=resolved_user_id,
            recommended_games=[candidate.game_id for candidate in self.candidates],
            strategy=self.strategy,
        )
