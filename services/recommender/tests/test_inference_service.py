from services.recommender.models.feature_contract import build_feature_vector_from_payload
from services.recommender.models.inference import (
    KerasInferenceService,
    RuleBasedInferenceService,
    build_inference_service,
)
from services.recommender.models.model_schema import ModelInputSchema
from services.recommender.training.feature_transform import build_training_feature_vector


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


def test_build_inference_service_returns_rule_based_when_model_missing() -> None:
    service = build_inference_service(None)

    assert isinstance(service, RuleBasedInferenceService)


def test_keras_inference_service_wraps_predict_call_and_ranks_results() -> None:
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

    assert model.calls == [[[2.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0]]]
    assert result.user_id == 12
    assert result.strategy == "keras_inference_v1"
    assert [candidate.game_id for candidate in result.candidates[:3]] == [2, 3, 1]


def test_keras_inference_service_uses_popularity_prior_for_hybrid_ranking() -> None:
    service = KerasInferenceService(
        model=_FakePredictModel(),
        candidate_index_map={1: 1001, 2: 1002, 3: 1003},
        popularity_prior_map={1: 1.0, 2: 0.5, 3: 0.7},
    )

    result = service.infer(
        ModelInputSchema(
            user_id=12,
            liked_keyword_ids=[1, 2],
            liked_platform_ids=[3],
            disliked_keyword_ids=[],
            disliked_platform_ids=[9],
        )
    )

    assert result.strategy == "keras_popularity_hybrid_v1"
    assert [candidate.game_id for candidate in result.candidates[:3]] == [1001, 1003, 1002]


def test_keras_inference_service_maps_candidate_indices_to_game_ids() -> None:
    service = KerasInferenceService(
        model=_FakePredictModel(),
        candidate_index_map={1: 1001, 2: 1002, 3: 1003},
    )

    result = service.infer(
        ModelInputSchema(
            user_id=12,
            liked_keyword_ids=[1, 2],
            liked_platform_ids=[3],
            disliked_keyword_ids=[],
            disliked_platform_ids=[9],
        )
    )

    assert [candidate.game_id for candidate in result.candidates[:3]] == [1002, 1003, 1001]


def test_keras_inference_service_skips_missing_candidate_map_key() -> None:
    service = KerasInferenceService(
        model=_FakePredictModel(),
        candidate_index_map={1: 201, 3: 203},
    )

    result = service.infer(
        ModelInputSchema(
            user_id=33,
            liked_keyword_ids=[1],
            liked_platform_ids=[],
            disliked_keyword_ids=[],
            disliked_platform_ids=[],
        )
    )

    assert [candidate.game_id for candidate in result.candidates] == [203, 201]
    assert [candidate.rank for candidate in result.candidates] == [1, 2]


def test_golden_train_vs_runtime_feature_parity_for_inference_payload() -> None:
    payload = ModelInputSchema(
        user_id=88,
        liked_keyword_ids=[11, 12, 13, 14],
        liked_platform_ids=[1, 2],
        disliked_keyword_ids=[21],
        disliked_platform_ids=[31, 32, 33],
        favorite_game_ids=[401, 402],
        questionnaire={
            "answers": {
                "pace": ["fast"],
                "session": ["short", "medium"],
            },
            "question_weights": {
                "pace": 1.0,
                "session": 1.5,
            },
        },
    )

    runtime_features = build_feature_vector_from_payload(payload)
    train_features = build_training_feature_vector(
        {
            "liked_keyword_count": 4,
            "liked_platform_count": 2,
            "disliked_keyword_count": 1,
            "disliked_platform_count": 3,
            "favorite_game_count": 2,
            "questionnaire_answer_count": 3,
            "questionnaire_total_weight": 4.0,
        }
    )

    assert runtime_features == train_features == [4.0, 2.0, 1.0, 3.0, 2.0, 3.0, 4.0]


def test_keras_inference_service_filters_nan_inf_scores_canary() -> None:
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
