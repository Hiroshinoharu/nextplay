from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .request import RecommendRequest
from .response import UserRecommendResponse


class ModelInputSchema(BaseModel):
    """Normalized model input payload produced from API request objects."""

    user_id: int | None = None
    liked_keyword_ids: list[int] = Field(default_factory=list)
    liked_platform_ids: list[int] = Field(default_factory=list)
    disliked_keyword_ids: list[int] = Field(default_factory=list)
    disliked_platform_ids: list[int] = Field(default_factory=list)
    questionnaire: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_recommend_request(cls, payload: RecommendRequest) -> "ModelInputSchema":
        return cls(
            user_id=payload.user_id,
            liked_keyword_ids=list(payload.liked_keywords),
            liked_platform_ids=list(payload.liked_platforms),
            disliked_keyword_ids=list(payload.disliked_keywords),
            disliked_platform_ids=list(payload.disliked_platforms),
            questionnaire=dict(payload.questionnaire or {}),
        )


class ModelCandidateScore(BaseModel):
    """Single ranked candidate returned by model inference."""

    game_id: int
    score: float = 0.0
    rank: int = 1
    reason: str | None = None


class ModelOutputSchema(BaseModel):
    """Normalized model output used to create API responses."""

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