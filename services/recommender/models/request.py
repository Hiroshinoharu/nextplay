from pydantic import BaseModel
from typing import List, Optional

class RecommendRequest(BaseModel):
    user_id: Optional[int] = None
    liked_keywords: List[int] = []
    liked_platforms: List[int] = []
    disliked_keywords: List[int] = []
    disliked_platforms: List[int] = []
    questionnaire: Optional[dict] = None   # future quiz input


class SimilarRequest(BaseModel):
    item_id: int
    top_k: int = 3
    filters: Optional[dict] = None
