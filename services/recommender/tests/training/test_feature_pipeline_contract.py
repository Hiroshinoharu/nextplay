from services.recommender.models.feature_contract import FEATURE_SCHEMA_VERSION, build_feature_vector_from_payload
from services.recommender.models.model_schema import ModelInputSchema
from services.recommender.training.feature_transform import build_training_feature_vector


def test_feature_pipeline_contract_train_infer_parity() -> None:
    request_payload = ModelInputSchema(
        user_id=42,
        liked_keyword_ids=[10, 11, 12],
        liked_platform_ids=[2],
        disliked_keyword_ids=[99, 100],
        disliked_platform_ids=[3, 4, 5],
        favorite_game_ids=[500, 501],
        questionnaire={
            "answers": {
                "preferred_pace": ["fast_action"],
                "session_length": ["under_30_min", "one_to_three_hours"],
            },
            "question_weights": {
                "preferred_pace": 1.0,
                "session_length": 1.5,
            },
        },
    )

    inference_features = build_feature_vector_from_payload(request_payload)
    training_features = build_training_feature_vector(
        {
            "liked_keyword_count": 3,
            "liked_platform_count": 1,
            "disliked_keyword_count": 2,
            "disliked_platform_count": 3,
            "favorite_game_count": 2,
            "questionnaire_answer_count": 3,
            "questionnaire_total_weight": 4.0,
        }
    )

    assert request_payload.feature_schema_version == FEATURE_SCHEMA_VERSION
    assert training_features == inference_features == [3.0, 1.0, 2.0, 3.0, 2.0, 3.0, 4.0]
