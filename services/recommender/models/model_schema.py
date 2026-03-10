from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .feature_contract import FEATURE_SCHEMA_VERSION
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
    feature_schema_version: str = FEATURE_SCHEMA_VERSION

    @classmethod
    def from_recommend_request(cls, payload: RecommendRequest) -> "ModelInputSchema":
        """
        Create a ModelInputSchema instance from a RecommendRequest payload.

        Converts a RecommendRequest object into a ModelInputSchema by extracting and
        formatting user preferences, keywords, platforms, and questionnaire data.

        Args:
            cls: The class being instantiated.
            payload (RecommendRequest): The recommendation request containing user preferences
                and questionnaire information.

        Returns:
            ModelInputSchema: An instance populated with user preferences, liked/disliked
                keywords and platforms, questionnaire data, and schema version information.

        Notes:
            - Uses questionnaire_raw when present, then falls back to questionnaire for backward compatibility.
            - feature_schema_version is extracted from that raw questionnaire blob when available,
              otherwise defaults to FEATURE_SCHEMA_VERSION constant.
        """
        raw_questionnaire = payload.questionnaire_raw or payload.questionnaire or {}
        schema_version = raw_questionnaire.get("feature_schema_version")
        return cls(
            user_id=payload.user_id,
            liked_keyword_ids=list(payload.liked_keywords),
            liked_platform_ids=list(payload.liked_platforms),
            disliked_keyword_ids=list(payload.disliked_keywords),
            disliked_platform_ids=list(payload.disliked_platforms),
            questionnaire=dict(raw_questionnaire),
            feature_schema_version=schema_version or FEATURE_SCHEMA_VERSION,
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
