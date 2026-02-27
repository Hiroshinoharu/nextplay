from services.recommender.models.feature_contract import build_feature_vector_from_payload
from services.recommender.models.inference import (
    KerasInferenceService,
    RuleBasedInferenceService,
    build_inference_service,
)

from services.recommender.models.model_schema import ModelInputSchema
from services.recommender.training.feature_transform import build_training_feature_vector


# Unit tests for inference.py to validate inference service behavior and model integration.
class _FakePredictModel:
    def __init__(self):
        self.calls = []

    def predict(self, payload):
        self.calls.append(payload)
        return [[0.2, 0.8, 0.4]]

class _FakeUnsafePredictModel:
    def predict(self, payload):
        return [[float("nan"), float("inf"), 0.9]]

class _FakeEmptyPredictModel:
    def predict(self, payload):
        return [[]]

# Test that build_inference_service returns a RuleBasedInferenceService when no model is provided
def test_build_inference_service_returns_rule_based_when_model_missing():
    service = build_inference_service(None)

    assert isinstance(service, RuleBasedInferenceService)


# Test that build_inference_service returns a KerasInferenceService when a model is provided
def test_keras_inference_service_wraps_predict_call_and_ranks_results():
    model = _FakePredictModel()
    service = KerasInferenceService(model=model)

    result = service.infer(
        ModelInputSchema(
            user_id=12,
            liked_keyword_ids=[1, 2],
            liked_platform_ids=[3],
            disliked_keyword_ids=[],
            disliked_platform_ids=[9],
        )
    )

    assert model.calls == [[[2.0, 1.0, 0.0, 1.0]]]
    assert result.user_id == 12
    assert result.strategy == "keras_inference_v1"
    assert [candidate.game_id for candidate in result.candidates[:3]] == [2, 3, 1]


def test_golden_train_vs_runtime_fewature_parity_for_inference_payload() -> None:
    """
    Test that feature vectors built from inference payload match those built during training.
    Verifies that the runtime feature extraction from a ModelInputSchema payload
    produces identical features to those computed during the training phase.
    This ensures feature parity between training and inference, which is critical
    for model consistency.
    The test validates that:
    - build_feature_vector_from_payload() correctly extracts features from an inference payload
    - build_feature_vector() produces the same feature vector when given equivalent training data
    - Both methods return the expected feature vector [4.0, 2.0, 1.0, 3.0]
    Returns:
        None
    """
    payload = ModelInputSchema(
        user_id = 88,
        liked_keyword_ids=[11, 12, 13, 14],
        liked_platform_ids=[1, 2],
        disliked_keyword_ids=[21],
        disliked_platform_ids=[31, 32, 33],
    )
    
    runtime_features = build_feature_vector_from_payload(payload)
    train_features = build_training_feature_vector({
        "liked_keyword_count": 4,
        "liked_platform_count": 2,
        "disliked_keyword_count": 1,
        "disliked_platform_count": 3,
    })
    
    assert runtime_features == train_features == [4.0, 2.0, 1.0, 3.0] 

def test_keras_inference_service_filters_nan_inf_scores_canary() -> None:
    """
    Test that KerasInferenceService filters out NaN and infinite scores from model predictions.
    This canary test verifies that when a model returns unsafe scores (NaN or infinity values),
    the inference service properly filters them out and only returns valid numeric candidates.
    Given a fake model that produces unsafe predictions, the service should:
    - Filter out any candidates with NaN or infinite scores
    - Return only candidates with valid numeric scores
    - Maintain the correct game_id and score for remaining candidates
    """
    service = KerasInferenceService(model=_FakeUnsafePredictModel())
    
    result = service.infer(
        ModelInputSchema(
            user_id=7,
            liked_keyword_ids=[1],
            liked_platform_ids=[2],
            disliked_keyword_ids=[],
            disliked_platform_ids=[],
        )
    )
    
    assert [candidate.game_id for candidate in result.candidates] == [3]
    assert [candidate.score for candidate in result.candidates] == [0.9]

def test_keras_inference_service_empty_candidate_canary() -> None:
    """
    Test that KerasInferenceService returns empty candidates when given empty preference lists.
    Verifies that the inference service correctly handles the edge case where a user
    has no liked or disliked keywords and platforms by returning an empty candidate list.
    """
    service = KerasInferenceService(model=_FakeEmptyPredictModel())

    result = service.infer(
        ModelInputSchema(
            user_id=9,
            liked_keyword_ids=[],
            liked_platform_ids=[],
            disliked_keyword_ids=[],
            disliked_platform_ids=[],
        )
    )

    assert result.candidates == []