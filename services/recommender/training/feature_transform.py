from __future__ import annotations

from services.recommender.models.feature_contract import (
    FEATURE_SCHEMA_VERSION,
    build_feature_vector_from_counts,
)


def build_training_feature_vector(row: dict[str, str | int | float]) -> list[float]:
    """Build canonical training features from preprocessed training-row style input."""

    def _count_from_value(value: str | int | float | None) -> int:
        if value is None:
            return 0
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if value == "":
            return 0
        return int(value)

    return build_feature_vector_from_counts(
        liked_keyword_count=_count_from_value(row.get("liked_keyword_count")),
        liked_platform_count=_count_from_value(row.get("liked_platform_count")),
        disliked_keyword_count=_count_from_value(row.get("disliked_keyword_count")),
        disliked_platform_count=_count_from_value(row.get("disliked_platform_count")),
    )


__all__ = ["FEATURE_SCHEMA_VERSION", "build_training_feature_vector"]