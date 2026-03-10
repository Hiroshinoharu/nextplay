from typing import Any, List, Optional

from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    user_id: Optional[int] = None
    liked_keywords: List[int] = Field(default_factory=list)
    liked_platforms: List[int] = Field(default_factory=list)
    disliked_keywords: List[int] = Field(default_factory=list)
    disliked_platforms: List[int] = Field(default_factory=list)
    # Legacy field kept for backward compatibility.
    questionnaire: Optional[dict[str, Any]] = None
    # Preferred Stage 2 field: raw questionnaire blob for logging/future features.
    questionnaire_raw: Optional[dict[str, Any]] = None


class SimilarRequest(BaseModel):
    item_id: int
    top_k: int = 3
    filters: Optional[dict] = None
