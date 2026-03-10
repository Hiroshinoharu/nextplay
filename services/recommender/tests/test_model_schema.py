import pytest

from services.recommender.models.feature_contract import FEATURE_SCHEMA_VERSION
from services.recommender.models.model_schema import (
    ModelCandidateScore,
    ModelInputSchema,
    ModelOutputSchema,
)
from services.recommender.models.request import RecommendRequest


# Unit tests for model_schema.py to validate schema transformations and mappings.
def test_model_input_schema_maps_from_recommend_request() -> None:
    # Unit tests are pure schema/mapping tests and do not query the database.
    payload = RecommendRequest(
        user_id=1,
        liked_keywords=[1, 2],
        liked_platforms=[7],
        disliked_keywords=[9],
        disliked_platforms=[3],
        questionnaire={"session_length": "short"},
    )

    model_input = ModelInputSchema.from_recommend_request(payload)

    assert model_input.user_id == 1
    assert model_input.liked_keyword_ids == [1, 2]
    assert model_input.liked_platform_ids == [7]
    assert model_input.disliked_keyword_ids == [9]
    assert model_input.disliked_platform_ids == [3]
    assert model_input.questionnaire == {"session_length": "short"}

# Test feature schema version defaults to the shared contract version
def test_model_input_schema_defaults_feature_schema_version() -> None:
    payload = RecommendRequest(
        user_id=3,
        liked_keywords=[],
        liked_platforms=[],
        disliked_keywords=[],
        disliked_platforms=[],
        questionnaire={},
    )

    model_input = ModelInputSchema.from_recommend_request(payload)

    assert model_input.feature_schema_version == FEATURE_SCHEMA_VERSION


# Test feature schema version can be set explicitly from questionnaire metadata
def test_model_input_schema_uses_explicit_feature_schema_version() -> None:
    payload = RecommendRequest(
        user_id=3,
        liked_keywords=[],
        liked_platforms=[],
        disliked_keywords=[],
        disliked_platforms=[],
        questionnaire={"feature_schema_version": "recommender_feature_schema_v2"},
    )

    model_input = ModelInputSchema.from_recommend_request(payload)

    assert model_input.feature_schema_version == "recommender_feature_schema_v2"
# Test Stage 2 field questionnaire_raw is used as the primary raw blob.
def test_model_input_schema_prefers_questionnaire_raw() -> None:
    payload = RecommendRequest(
        user_id=3,
        liked_keywords=[],
        liked_platforms=[],
        disliked_keywords=[],
        disliked_platforms=[],
        questionnaire={"feature_schema_version": "recommender_feature_schema_v1", "legacy": True},
        questionnaire_raw={"feature_schema_version": "recommender_feature_schema_v2", "session_length": "short"},
    )

    model_input = ModelInputSchema.from_recommend_request(payload)

    assert model_input.questionnaire == {
        "feature_schema_version": "recommender_feature_schema_v2",
        "session_length": "short",
    }
    assert model_input.feature_schema_version == "recommender_feature_schema_v2"


# Test backward compatibility when only legacy questionnaire is provided.
def test_model_input_schema_uses_legacy_questionnaire_when_raw_missing() -> None:
    payload = RecommendRequest(
        user_id=3,
        liked_keywords=[],
        liked_platforms=[],
        disliked_keywords=[],
        disliked_platforms=[],
        questionnaire={"session_length": "short"},
    )

    model_input = ModelInputSchema.from_recommend_request(payload)

    assert model_input.questionnaire == {"session_length": "short"}

# Additional tests for ModelOutputSchema to validate conversion to API response format.
def test_model_output_schema_maps_to_user_recommend_response() -> None:
    model_output = ModelOutputSchema(
        user_id=2,
        strategy="keras_two_tower_v1",
        candidates=[
            ModelCandidateScore(game_id=120, score=0.98, rank=1),
            ModelCandidateScore(game_id=77, score=0.93, rank=2),
        ],
    )

    response = model_output.to_user_recommend_response()

    assert response.user_id == 2
    assert response.recommended_games == [120, 77]
    assert response.strategy == "keras_two_tower_v1"

# Test that ModelOutputSchema can use fallback_user_id if user_id is not set
def test_model_output_schema_uses_fallback_user_id() -> None:
    model_output = ModelOutputSchema(
        strategy="keras_two_tower_v1",
        candidates=[ModelCandidateScore(game_id=120, score=0.98, rank=1)],
    )

    response = model_output.to_user_recommend_response(fallback_user_id=1)

    assert response.user_id == 1
    assert response.recommended_games == [120]


# Test that ModelOutputSchema raises an error if user_id is not set and no fallback is provided
def test_model_output_schema_requires_user_id_if_fallback_not_provided() -> None:
    model_output = ModelOutputSchema(strategy="keras_two_tower_v1")

    with pytest.raises(ValueError, match="user_id is required to build UserRecommendResponse"):
        model_output.to_user_recommend_response()
