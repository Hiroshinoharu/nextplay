from services.recommender.models.feature_contract import FEATURE_SCHEMA_VERSION, build_feature_vector_from_payload
from services.recommender.models.model_schema import ModelInputSchema
from services.recommender.training.feature_transform import build_training_feature_vector

def test_feature_pipeline_contract_train_infer_parity() -> None:
    """
    Verify that the feature pipeline maintains parity between training and inference paths.
    This test ensures that:
    1. The inference feature vector built from a user request payload matches
        the training feature vector built from aggregated feature counts
    2. Both vectors are constructed in the same order and format
    3. The feature schema version is consistent with the expected version
    The test validates that a request with:
    - 3 liked keywords, 1 liked platform
    - 2 disliked keywords, 3 disliked platforms
    Produces identical feature vectors [3.0, 1.0, 2.0, 3.0] in both training and inference modes.
    """
    request_payload = ModelInputSchema(
        user_id=42,
        liked_keyword_ids=[10, 11, 12],
        liked_platform_ids=[2],
        disliked_keyword_ids=[99, 100],
        disliked_platform_ids=[3, 4, 5],
    )

    inference_features = build_feature_vector_from_payload(request_payload)
    training_features = build_training_feature_vector(
        {
            "liked_keyword_count": 3,
            "liked_platform_count": 1,
            "disliked_keyword_count": 2,
            "disliked_platform_count": 3,
        }
    )

    assert request_payload.feature_schema_version == FEATURE_SCHEMA_VERSION
    assert training_features == inference_features == [3.0, 1.0, 2.0, 3.0]