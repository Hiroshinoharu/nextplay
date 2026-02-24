from services.recommender.models.inference import (
    KerasInferenceService,
    RuleBasedInferenceService,
    build_inference_service,
)
from services.recommender.models.model_schema import ModelInputSchema


# Unit tests for inference.py to validate inference service behavior and model integration.
class _FakePredictModel:
    def __init__(self):
        self.calls = []

    def predict(self, payload):
        self.calls.append(payload)
        return [[0.2, 0.8, 0.4]]

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