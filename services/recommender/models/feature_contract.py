from __future__ import annotations

from typing import Any

FEATURE_SCHEMA_VERSION = "recommender_feature_schema_v1"

def build_feature_vector_from_counts(
    *,
    liked_keyword_count: int,
    liked_platform_count: int,
    disliked_keyword_count: int,
    disliked_platform_count: int,
) -> list[float]:
    """Build the canonical feature vector shared by training and inference."""
    return [
        float(liked_keyword_count),
        float(liked_platform_count),
        float(disliked_keyword_count),
        float(disliked_platform_count),
    ]

def build_feature_vector_from_payload(payload: Any) -> list[float]:
    """Build canonical feature vector from a payload exposing liked/disliked id lists."""
    return build_feature_vector_from_counts(
        liked_keyword_count=len(payload.liked_keyword_ids),
        liked_platform_count=len(payload.liked_platform_ids),
        disliked_keyword_count=len(payload.disliked_keyword_ids),
        disliked_platform_count=len(payload.disliked_platform_ids),
    )