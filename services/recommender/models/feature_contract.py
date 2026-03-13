from __future__ import annotations

from typing import Any

FEATURE_SCHEMA_VERSION = "recommender_feature_schema_v1"


def _coerce_count(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return max(0, int(value))
    if value == "":
        return 0
    return max(0, int(value))


def _questionnaire_answer_count(questionnaire: Any) -> int:
    if not isinstance(questionnaire, dict):
        return 0

    answers = questionnaire.get("answers")
    if not isinstance(answers, dict):
        return 0

    total = 0
    for selected in answers.values():
        if isinstance(selected, list):
            total += len([value for value in selected if value not in (None, "")])
        elif selected not in (None, ""):
            total += 1
    return total


def _questionnaire_total_weight(questionnaire: Any) -> float:
    if not isinstance(questionnaire, dict):
        return 0.0

    answers = questionnaire.get("answers")
    question_weights = questionnaire.get("question_weights")
    if not isinstance(answers, dict) or not isinstance(question_weights, dict):
        return 0.0

    total_weight = 0.0
    for question_id, selected in answers.items():
        if isinstance(selected, list):
            selected_count = len([value for value in selected if value not in (None, "")])
        elif selected not in (None, ""):
            selected_count = 1
        else:
            selected_count = 0
        if selected_count <= 0:
            continue
        try:
            weight = float(question_weights.get(question_id, 1.0))
        except (TypeError, ValueError):
            weight = 1.0
        total_weight += weight * selected_count
    return total_weight


def _favorite_game_count_from_payload(payload: Any) -> int:
    favorite_ids = getattr(payload, "favorite_game_ids", None)
    if isinstance(favorite_ids, list):
        return len([value for value in favorite_ids if value is not None])

    questionnaire = getattr(payload, "questionnaire", None)
    if isinstance(questionnaire, dict):
        questionnaire_favorites = questionnaire.get("favorite_game_ids")
        if isinstance(questionnaire_favorites, list):
            return len([value for value in questionnaire_favorites if value is not None])
    return 0


def build_feature_vector_from_counts(
    *,
    liked_keyword_count: int,
    liked_platform_count: int,
    disliked_keyword_count: int,
    disliked_platform_count: int,
    favorite_game_count: int = 0,
    questionnaire_answer_count: int = 0,
    questionnaire_total_weight: float = 0.0,
) -> list[float]:
    """Build the canonical feature vector shared by training and inference."""
    return [
        float(_coerce_count(liked_keyword_count)),
        float(_coerce_count(liked_platform_count)),
        float(_coerce_count(disliked_keyword_count)),
        float(_coerce_count(disliked_platform_count)),
        float(_coerce_count(favorite_game_count)),
        float(_coerce_count(questionnaire_answer_count)),
        float(max(0.0, questionnaire_total_weight)),
    ]


def build_feature_vector_from_payload(payload: Any) -> list[float]:
    """Build canonical feature vector from a payload exposing liked/disliked ids, favorites, and questionnaire metadata."""
    questionnaire = getattr(payload, "questionnaire", {})
    return build_feature_vector_from_counts(
        liked_keyword_count=len(payload.liked_keyword_ids),
        liked_platform_count=len(payload.liked_platform_ids),
        disliked_keyword_count=len(payload.disliked_keyword_ids),
        disliked_platform_count=len(payload.disliked_platform_ids),
        favorite_game_count=_favorite_game_count_from_payload(payload),
        questionnaire_answer_count=_questionnaire_answer_count(questionnaire),
        questionnaire_total_weight=_questionnaire_total_weight(questionnaire),
    )
