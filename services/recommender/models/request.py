from pydantic import BaseModel, Field
from typing import List, Optional

class RecommendRequest(BaseModel):
    user_id: Optional[int] = None
    liked_keywords: List[int] = Field(default_factory=list)
    liked_platforms: List[int] = Field(default_factory=list)
    disliked_keywords: List[int] = Field(default_factory=list)
    disliked_platforms: List[int] = Field(default_factory=list)
    questionnaire: Optional[dict] = None   # future quiz input


class SimilarRequest(BaseModel):
    item_id: int
    top_k: int = 3
    filters: Optional[dict] = None
