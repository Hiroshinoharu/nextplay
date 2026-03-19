import os
from fastapi.testclient import TestClient
import pytest

from services.recommender.main import app
from services.recommender.handlers.recommend import (
    _build_personalized_recommendation_ids,
    _extract_release_year_preference,
    _is_strict_release_year_preference,
    _release_era_alignment_score,
    _release_year_matches_preference,
)
from services.recommender.models.model_schema import ModelCandidateScore, ModelOutputSchema

TEST_SERVICE_TOKEN = os.environ.get('GATEWAY_SERVICE_TOKEN', 'test-service-token')
client = TestClient(app, headers={'X-Service-Token': TEST_SERVICE_TOKEN})


class _Resp:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _HTTP:
    def __init__(self, responses):
        self.responses = responses

    def get(self, url, timeout):
        return self.responses.get(url, _Resp(404, {"error": "not found"}))


# Test cases for GET /recommend/user/{user_id}
def test_get_recommend_for_user_valid_id_returns_expected_payload():
    response = client.get("/recommend/user/1")
    
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) >= {'user_id', 'recommended_games', 'strategy'}
    assert body['user_id'] == 1
    assert body['recommended_games'] == [71, 72, 73, 74, 75]
    assert body['strategy'] == 'placeholder_user_based'
    assert body.get("scored_recommendations") == []


def test_get_recommend_for_user_invalid_id_returns_400_with_clear_detail():
    """
    Testing for a valid error 400 and makes sure you get proper details about it
    """
    response = client.get("/recommend/user/0")
    
    assert response.status_code == 400
    body = response.json()
    assert 'detail' in body
    assert body['detail'] == "Invalid user id"


def test_existing_recommend_item_and_recommend_routes_still_respond_as_expected():
    app.state.service_urls = {"game": "http://game", "user": "http://user"}
    app.state.http = _HTTP(
        {
            "http://game/games/10": _Resp(200, {"id": 10, "name": "Resident Evil 4", "genre": "Action"}),
            "http://game/games/10/related-content?limit=80": _Resp(
                200,
                [
                    {"id": 11, "name": "Resident Evil 5", "genre": "Action", "popularity": 90.0},
                    {"id": 12, "name": "Resident Evil 6", "genre": "Action", "popularity": 80.0},
                    {"id": 13, "name": "Resident Evil Village", "genre": "Action", "popularity": 85.0},
                ],
            ),
            "http://game/games/search?q=Resident Evil 4&mode=contains&limit=120": _Resp(
                200,
                [
                    {"id": 14, "name": "Resident Evil Revelations", "genre": "Action", "popularity": 70.0},
                    {"id": 15, "name": "Resident Evil 0", "genre": "Action", "popularity": 60.0},
                    {"id": 16, "name": "Resident Evil Code Veronica", "genre": "Action", "popularity": 50.0},
                ],
            ),
            "http://game/games/11": _Resp(200, {"id": 11, "name": "Persona 5 Royal", "genre": "RPG"}),
            "http://game/games/11/related-content?limit=80": _Resp(
                200,
                [{"id": 21 + i, "name": f"Persona 5 DLC {i}", "genre": "RPG", "popularity": float(100 - i)} for i in range(1, 55)],
            ),
            "http://game/games/search?q=Persona 5 Royal&mode=contains&limit=120": _Resp(
                200,
                [{"id": 200 + i, "name": f"Persona 5 Related {i}", "genre": "RPG", "popularity": float(50 - i)} for i in range(1, 25)],
            ),
        }
    )

    item_response = client.get("/recommend/item/10")
    assert item_response.status_code == 200
    item_body = item_response.json()
    assert item_body["item_id"] == 10
    assert item_body["top_k"] is None
    assert item_body["filters"] is None
    assert len(item_body["similar_items"]) == 3

    class _Inference:
        def infer(self, payload):
            return ModelOutputSchema(
                user_id=payload.user_id,
                strategy="keras_inference_v1",
                candidates=[
                    ModelCandidateScore(game_id=901, score=0.95, rank=1),
                    ModelCandidateScore(game_id=902, score=0.90, rank=2),
                    ModelCandidateScore(game_id=903, score=0.85, rank=3),
                ],
            )

    app.state.inference_service = _Inference()
    app.state.model = object()
    recommend_response = client.post(
        '/recommend',
        json={
            'user_id': 1,
            'liked_keywords': [1, 2],
            'liked_platforms': [3],
            'disliked_platforms': [4],
            'questionnaire': {'genre': 'strategy'}
        },
    )
    assert recommend_response.status_code == 200
    recommend_body = recommend_response.json()
    assert recommend_body["user_id"] == 1
    assert recommend_body["recommended_games"] == [901, 902, 903]
    assert recommend_body["strategy"] == "keras_inference_v1"
    scored = recommend_body["scored_recommendations"]
    assert [row["game_id"] for row in scored] == [901, 902, 903]
    assert [row["rank"] for row in scored] == [1, 2, 3]
    assert scored[0]["score"] == 99.0
    assert scored[-1]["score"] == 40.0
    assert scored[0]["score"] > scored[1]["score"] > scored[2]["score"]
    
    similar_post_response = client.post('/recommend/item', json={'item_id': 11, 'top_k': 5})
    assert similar_post_response.status_code == 200
    post_body = similar_post_response.json()
    assert post_body["item_id"] == 11
    assert post_body["top_k"] == 5
    assert post_body["filters"] == {}
    assert len(post_body["similar_items"]) == 5
    delattr(app.state, 'inference_service')
    delattr(app.state, 'model')
    delattr(app.state, 'service_urls')
    delattr(app.state, 'http')

# Test that POST /recommend calls the inference service when available
def test_recommend_route_calls_inference_service_when_available():
    """
    This will test that the recommend route calls the inference service when it's available in the app state.
    It uses a stub inference service that records calls to its infer method, and then asserts that it was called with the expected payload.
    """
    class _StubInference:
        """
        A stub inference service that records calls to its infer method.
        """
        def __init__(self):
            self.calls = []

        def infer(self, payload):
            self.calls.append(payload)
            return ModelOutputSchema(
                user_id=payload.user_id,
                strategy="test_inference_v1",
                candidates=[ModelCandidateScore(game_id=99, score=1.0, rank=1)],
            )

    stub = _StubInference()
    app.state.inference = stub
    app.state.model = object()

    response = client.post(
        '/recommend',
        json={
            'user_id': 33,
            'liked_keywords': [1],
            'liked_platforms': [2],
            'disliked_platforms': [],
        },
    )

    assert response.status_code == 200
    assert len(stub.calls) == 1
    assert stub.calls[0].user_id == 33

    delattr(app.state, 'inference')
    delattr(app.state, 'model')

def test_recommend_for_user_live_dependencies_and_ranks_candidates(monkeypatch):
    """Recommend-for-user should personalize from positive interaction history only."""
    app.state.service_urls = {
        "user": "http://user",
        "game": "http://game",
    }
    app.state.http = _HTTP(
        {
            "http://user/users/9/interactions": _Resp(
                200,
                [
                    {"game_id": 11, "favorited": True, "liked": True},
                    {"game_id": 12, "favorited": False, "liked": False},
                ],
            ),
            "http://game/games/top?limit=200": _Resp(
                200,
                [
                    {"id": 200, "genre": "Action", "description": "space tactics", "popularity": 999.0, "aggregated_rating": 91.0},
                    {"id": 101, "genre": "Action", "description": "space tactics", "popularity": 800.0, "aggregated_rating": 89.0},
                    {"id": 103, "genre": "RPG", "description": "party story", "popularity": 600.0, "aggregated_rating": 88.0},
                ],
            ),
            "http://game/games/11": _Resp(200, {"id": 11, "genre": "Action", "keywords": [4], "platforms": [10], "description": "space tactics"}),
            "http://game/games/11/related-content?limit=20": _Resp(200, [{"id": 200}, {"id": 101}]),
            "http://game/games/search?q=&mode=contains&limit=120": _Resp(404, {"error": "not found"}),
        }
    )
    monkeypatch.setattr(
        "services.recommender.handlers.recommend._build_favorite_profile",
        lambda request, favorite_game_ids: ({4}, {10}, {"action"}, [{"space", "tactics"}]),
    )

    response = client.get("/recommend/user/9")

    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == 9
    assert 200 in body["recommended_games"]
    assert 101 in body["recommended_games"]
    assert 12 not in body["recommended_games"]
    assert body["strategy"] == "interaction_history_hybrid_v1"
    assert body["scored_recommendations"][0]["game_id"] == body["recommended_games"][0]

    for attr in ("service_urls", "http", "request_timeout"):
        if hasattr(app.state, attr):
            delattr(app.state, attr)

@pytest.mark.parametrize(
    "payload, expected_top_k",
    [
        ({"item_id": 11, "top_k": 0}, 1),
        ({"item_id": 11, "top_k": 999}, 50),
    ],
)
def test_post_reccomend_items_clamps_top_k(payload, expected_top_k):
    """
    This will test that the POST /recommend/item endpoint correctly clamps the top_k parameter to a maximum of 50.
    It sends requests with different top_k values and asserts that the response contains the expected number of similar items.
    """
    app.state.service_urls = {"game": "http://game", "user": "http://user"}
    app.state.http = _HTTP(
        {
            "http://game/games/11": _Resp(200, {"id": 11, "name": "Persona 5 Royal", "genre": "RPG"}),
            "http://game/games/11/related-content?limit=200": _Resp(
                200,
                [{"id": 1000 + i, "name": f"P5 candidate {i}", "genre": "RPG", "popularity": float(1000 - i)} for i in range(1, 260)],
            ),
            "http://game/games/search?q=Persona 5 Royal&mode=contains&limit=120": _Resp(
                200,
                [{"id": 2000 + i, "name": f"P5 search {i}", "genre": "RPG", "popularity": float(600 - i)} for i in range(1, 140)],
            ),
        }
    )
    response = client.post('/recommend/item', json=payload)
    
    assert response.status_code == 200
    body = response.json()
    assert body['item_id'] == 11
    assert body['top_k'] == expected_top_k
    assert len(body['similar_items']) == expected_top_k
    delattr(app.state, "service_urls")
    delattr(app.state, "http")

def test_post_recommend_items_invalid_id_returns_400():
    """
    This will test that the POST /recommend/item endpoint returns a 400 error with clear details when an invalid item_id is provided.
    It sends a request with an invalid item_id and asserts that the response status code is 400 and that the response body contains a 'detail' field with the expected error message.
    """
    response = client.post('/recommend/item', json={"item_id": -1})
    
    assert response.status_code == 400
    body = response.json()
    assert 'detail' in body
    assert body['detail'] == "Invalid item id"


def test_recommend_route_falls_back_when_inference_raises_and_records_metrics():
    """
    This will test that the recommend route correctly falls back to the fallback inference when the main inference service raises an error, and that it records metrics for total requests, fallback usage, and latency.
    It uses a stub inference service that raises an error, and a fallback inference that records calls to its infer method. It then asserts that the fallback was called and that the metrics were updated as
    """
    class _FailingInference:
        def infer(self, payload):
            raise RuntimeError("boom")
    
    class _FallbackInference:
        def __init__(self):
            self.calls = []
        
        def infer(self, payload):
            self.calls.append(payload)
            return ModelOutputSchema(
                user_id=payload.user_id,
                strategy="rule_based_fallback_v1",
                candidates=[ModelCandidateScore(game_id=77, score=1.0, rank=1)],
            )

    fallback = _FallbackInference()
    app.state.inference_service = _FailingInference()
    app.state.fallback_inference = fallback
    app.state.model = object()
    app.state.model_version = "vtest"
    app.state.model_load_failed = False
    app.state.metrics = {
        "recommend_requests_total": 0,
        "recommend_fallback_total": 0,  # Start with 1 to verify it increments to 2
        "recommend_errors_total": 0,
        "recommend_latency_ms_total": 0.0,
        "recommend_latency_ms_max": 0.0,
    }
    
    response = client.post(
        '/recommend',
        json={
            'user_id': 44,
            'liked_keywords': [1],
            'liked_platforms': [2],
            'disliked_platforms': [],
        },
    )
    
    assert response.status_code == 200
    assert len(fallback.calls) == 1
    assert app.state.metrics["recommend_requests_total"] == 1
    assert app.state.metrics["recommend_fallback_total"] == 1
    assert app.state.metrics["recommend_fallbacks_total"] == 1
    assert app.state.metrics["recommend_errors_total"] == 1
    assert app.state.metrics["recommend_error_total"] == 1
    assert app.state.metrics["recommend_outcome_model_inference_failure_with_fallback_total"] == 1
    assert app.state.metrics["recommend_fallback_reason_inference_exception_total"] == 1
    assert app.state.metrics["recommend_latency_ms_total"] >= 0.0
    assert app.state.metrics["recommend_latency_ms"] >= 0.0
    assert app.state.metrics["recommend_latency_ms_max"] >= 0.0

    delattr(app.state, 'model')
    delattr(app.state, 'inference_service')
    delattr(app.state, 'fallback_inference')
    delattr(app.state, 'model_version')
    delattr(app.state, 'model_load_failed')
    delattr(app.state, 'metrics')

def test_reccomend_route_records_metrics_without_fallback():
    """This will test that the recommend route correctly records metrics when the inference service is available and does not raise an error.
        It uses a stub inference service that does not raise an error, and then asserts that the metrics for total requests, fallback usage, and latency are recorded as expected.
    """
    class _Inference:
        """
        A stub inference service that simulates a successful inference call.
        """
        def infer(self, payload):
            return ModelOutputSchema(
                user_id=payload.user_id,
                strategy="keras_inference_v1",
                candidates=[ModelCandidateScore(game_id=88, score=0.9, rank=1)]
            )
    
    app.state.inference_service = _Inference()
    app.state.model = object()
    app.state.model_version = "vtest"
    app.state.metrics = {
        "recommend_requests_total": 0,
        "recommend_fallback_total": 0,
        "recommend_errors_total": 0,
        "recommend_latency_ms_total": 0.0,
        "recommend_latency_ms_max": 0.0,
    }
    
    response = client.post(
        '/recommend',
        json={
            'user_id': 55,
            'liked_keywords': [1],
            'liked_platforms': [2],
            'disliked_platforms': [],
        },
    )
    
    assert response.status_code == 200
    assert app.state.metrics["recommend_requests_total"] == 1
    assert app.state.metrics["recommend_fallback_total"] == 0
    assert app.state.metrics.get("recommend_fallbacks_total", 0) == 0
    assert app.state.metrics["recommend_errors_total"] == 0
    assert app.state.metrics.get("recommend_error_total", 0) == 0
    assert app.state.metrics["recommend_outcome_model_inference_success_total"] == 1
    assert app.state.metrics["recommend_latency_ms_total"] >= 0.0
    assert app.state.metrics["recommend_latency_ms"] >= 0.0
    assert app.state.metrics["recommend_latency_ms_max"] >= 0.0

    delattr(app.state, 'model')
    delattr(app.state, 'inference_service')
    delattr(app.state, 'model_version')
    delattr(app.state, 'metrics')


def test_recommend_route_fallback_only_mode_records_load_failure_reason():
    class _FallbackInference:
        def __init__(self):
            self.calls = []

        def infer(self, payload):
            self.calls.append(payload)
            return ModelOutputSchema(
                user_id=payload.user_id,
                strategy="rule_based_fallback_v1",
                candidates=[ModelCandidateScore(game_id=77, score=1.0, rank=1)],
            )

    fallback = _FallbackInference()
    app.state.inference_service = fallback
    app.state.fallback_inference = fallback
    app.state.model = None
    app.state.model_load_failed = True
    app.state.model_version = "vtest"
    app.state.metrics = {
        "recommend_requests_total": 0,
        "recommend_fallback_total": 0,
        "recommend_errors_total": 0,
        "recommend_latency_ms_total": 0.0,
        "recommend_latency_ms_max": 0.0,
    }

    response = client.post(
        '/recommend',
        json={
            'user_id': 66,
            'liked_keywords': [1],
            'liked_platforms': [2],
            'disliked_platforms': [],
        },
    )

    assert response.status_code == 200
    assert len(fallback.calls) == 1
    assert app.state.metrics["recommend_outcome_fallback_only_mode_total"] == 1
    assert app.state.metrics["recommend_fallback_reason_load_failure_total"] == 1
    assert app.state.metrics["recommend_fallback_total"] == 1

    delattr(app.state, 'inference_service')
    delattr(app.state, 'fallback_inference')
    delattr(app.state, 'model')
    delattr(app.state, 'model_load_failed')
    delattr(app.state, 'model_version')
    delattr(app.state, 'metrics')


def test_recommend_route_falls_back_on_empty_candidates_and_records_reason():
    class _EmptyInference:
        def infer(self, payload):
            return ModelOutputSchema(
                user_id=payload.user_id,
                strategy="keras_inference_v1",
                candidates=[],
            )

    class _FallbackInference:
        def __init__(self):
            self.calls = []

        def infer(self, payload):
            self.calls.append(payload)
            return ModelOutputSchema(
                user_id=payload.user_id,
                strategy="rule_based_fallback_v1",
                candidates=[ModelCandidateScore(game_id=17, score=1.0, rank=1)],
            )

    fallback = _FallbackInference()
    app.state.inference_service = _EmptyInference()
    app.state.fallback_inference = fallback
    app.state.model = object()
    app.state.model_load_failed = False
    app.state.model_version = "vtest"
    app.state.metrics = {
        "recommend_requests_total": 0,
        "recommend_fallback_total": 0,
        "recommend_errors_total": 0,
        "recommend_latency_ms_total": 0.0,
        "recommend_latency_ms_max": 0.0,
    }

    response = client.post(
        '/recommend',
        json={
            'user_id': 77,
            'liked_keywords': [1],
            'liked_platforms': [2],
            'disliked_platforms': [],
        },
    )

    assert response.status_code == 200
    assert len(fallback.calls) == 1
    assert app.state.metrics["recommend_outcome_model_inference_failure_with_fallback_total"] == 1
    assert app.state.metrics["recommend_fallback_reason_empty_candidates_total"] == 1
    assert app.state.metrics["recommend_fallback_total"] == 1

    delattr(app.state, 'inference_service')
    delattr(app.state, 'fallback_inference')
    delattr(app.state, 'model')
    delattr(app.state, 'model_load_failed')
    delattr(app.state, 'model_version')
    delattr(app.state, 'metrics')

def test_recommend_route_requires_user_id_in_payload():
    response = client.post(
        '/recommend',
        json={
            'liked_keywords': [1],
            'liked_platforms': [2],
        },
    )

    assert response.status_code == 400
    assert response.json() == {'detail': 'user_id is required for /recommend'}


def test_release_year_preference_supports_strict_only_variants() -> None:
    preference = _extract_release_year_preference(
        {"answers": {"era_preference": ["latest_2020_plus_only"]}}
    )

    assert preference == "latest_2020_plus_only"
    assert _is_strict_release_year_preference(preference) is True
    assert _release_year_matches_preference(2021, preference) is True
    assert _release_year_matches_preference(2019, preference) is False


def test_release_year_preference_keeps_soft_latest_choice_but_penalizes_older_titles() -> None:
    preference = _extract_release_year_preference(
        {"answers": {"era_preference": ["latest_2020_plus"]}}
    )

    assert preference == "latest_2020_plus"
    assert _is_strict_release_year_preference(preference) is False
    assert _release_era_alignment_score(2022, preference) > _release_era_alignment_score(2018, preference)
    assert _release_era_alignment_score(2018, preference) > _release_era_alignment_score(2012, preference)


def test_recommend_route_returns_trace_metadata_for_feedback_capture():
    class _StubInference:
        def infer(self, payload):
            return ModelOutputSchema(
                user_id=payload.user_id,
                strategy="test_trace_v1",
                candidates=[ModelCandidateScore(game_id=501, score=0.91, rank=1)],
            )

    app.state.inference_service = _StubInference()
    app.state.model = object()
    app.state.model_version = "trace-model-v1"

    response = client.post(
        "/recommend",
        json={
            "user_id": 7,
            "liked_keywords": [1],
            "liked_platforms": [2],
            "disliked_platforms": [],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["request_id"]
    assert body["model_version"] == "trace-model-v1"
    assert body["ranking_profile"] == "balanced_v1"
    assert body["outcome"] == "model_inference_success"

    delattr(app.state, "inference_service")
    delattr(app.state, "model")
    delattr(app.state, "model_version")


def test_personalized_ranking_applies_diversity_and_recent_exposure_penalty(monkeypatch):
    request = type("Req", (), {})()
    request.app = type("App", (), {})()
    request.app.state = type("State", (), {})()

    monkeypatch.setattr(
        "services.recommender.handlers.recommend._fetch_candidate_games_for_user",
        lambda request, limit=200: [
            {"id": 1, "name": "Alpha Strike", "genre": "Action", "description": "squad tactics", "popularity": 2000.0, "aggregated_rating": 88.0},
            {"id": 2, "name": "Alpha Strike", "genre": "Action", "description": "squad tactics", "popularity": 1900.0, "aggregated_rating": 87.0},
            {"id": 3, "name": "Rune Atlas", "genre": "RPG", "description": "party tactics", "popularity": 1200.0, "aggregated_rating": 90.0},
            {"id": 4, "name": "Puzzle Harbor", "genre": "Puzzle", "description": "calm logic", "popularity": 900.0, "aggregated_rating": 86.0},
        ],
    )
    monkeypatch.setattr(
        "services.recommender.handlers.recommend._build_favorite_profile",
        lambda request, favorite_game_ids: (set(), set(), set(), []),
    )
    monkeypatch.setattr(
        "services.recommender.handlers.recommend._build_avoid_profile",
        lambda request, avoided_game_ids: (set(), set(), set(), []),
    )

    first_ids, _ = _build_personalized_recommendation_ids(
        request,
        liked_keyword_ids=set(),
        liked_platform_ids=set(),
        disliked_keyword_ids=set(),
        disliked_platform_ids=set(),
        favorite_game_ids=[],
        avoided_game_ids=[],
        answer_token_weights={},
        favorite_seed_ids=[],
        model_seed_ids=[],
        release_year_preference="",
        top_n=3,
        ranking_seed="fixed-seed",
        recently_shown_game_ids={1},
    )
    second_ids, _ = _build_personalized_recommendation_ids(
        request,
        liked_keyword_ids=set(),
        liked_platform_ids=set(),
        disliked_keyword_ids=set(),
        disliked_platform_ids=set(),
        favorite_game_ids=[],
        avoided_game_ids=[],
        answer_token_weights={},
        favorite_seed_ids=[],
        model_seed_ids=[],
        release_year_preference="",
        top_n=3,
        ranking_seed="fixed-seed",
        recently_shown_game_ids={1},
    )

    assert first_ids == second_ids
    assert len(set(first_ids)) == len(first_ids)
    assert first_ids[0] != 1


def test_recommend_route_uses_full_interaction_history_to_personalize():
    class _Inference:
        def infer(self, payload):
            return ModelOutputSchema(
                user_id=payload.user_id,
                strategy="rule_based_fallback_v1",
                candidates=[],
            )

    app.state.service_urls = {
        "user": "http://user",
        "game": "http://game",
    }
    app.state.http = _HTTP(
        {
            "http://user/users/12/interactions": _Resp(
                200,
                [
                    {"game_id": 1001, "favorited": True, "liked": True, "rating": 9.5},
                    {"game_id": 1002, "favorited": False, "liked": True, "rating": 8.0},
                    {"game_id": 1003, "favorited": False, "liked": False, "rating": 2.0},
                ],
            ),
            "http://user/users/12/interactions/events?event_type=recommendation_exposure&limit=120": _Resp(200, []),
            "http://game/games/top?limit=300": _Resp(
                200,
                [
                    {"id": 501, "name": "Star Tactics", "genre": "Strategy", "description": "space tactics fleet command", "keywords": [77], "platforms": [6], "popularity": 900.0, "aggregated_rating": 90.0},
                    {"id": 502, "name": "Galaxy Orders", "genre": "Strategy", "description": "space tactics squad planning", "keywords": [77], "platforms": [6], "popularity": 870.0, "aggregated_rating": 88.0},
                    {"id": 503, "name": "Dread Arena", "genre": "Horror", "description": "grim horror survival panic", "keywords": [88], "platforms": [9], "popularity": 950.0, "aggregated_rating": 91.0},
                ],
            ),
            "http://game/games/1001": _Resp(200, {"id": 1001, "name": "Fleet Doctrine", "genre": "Strategy", "description": "space tactics fleet command", "keywords": [77], "platforms": [6]}),
            "http://game/games/1001/related-content?limit=160": _Resp(200, [{"id": 501}, {"id": 502}]),
            "http://game/games/search?q=Fleet Doctrine&mode=contains&limit=120": _Resp(200, [{"id": 501}, {"id": 502}]),
            "http://game/games/1002": _Resp(200, {"id": 1002, "name": "Orbit Planner", "genre": "Strategy", "description": "space tactics squad planning", "keywords": [77], "platforms": [6]}),
            "http://game/games/1002/related-content?limit=160": _Resp(200, [{"id": 502}, {"id": 501}]),
            "http://game/games/search?q=Orbit Planner&mode=contains&limit=120": _Resp(200, [{"id": 502}, {"id": 501}]),
            "http://game/games/1003": _Resp(200, {"id": 1003, "name": "Night Panic", "genre": "Horror", "description": "grim horror survival panic", "keywords": [88], "platforms": [9]}),
        }
    )
    app.state.inference_service = _Inference()
    app.state.model = object()

    response = client.post(
        "/recommend",
        json={
            "user_id": 12,
            "liked_keywords": [],
            "liked_platforms": [],
            "disliked_keywords": [],
            "disliked_platforms": [],
            "favorite_game_ids": [],
            "questionnaire": {
                "answers": {},
                "question_weights": {},
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["strategy"] == "hybrid_profile_fallback_v1"
    assert body["recommended_games"][:2] == [501, 502]
    assert 503 not in body["recommended_games"]

    for attr in ("service_urls", "http", "inference_service", "model"):
        if hasattr(app.state, attr):
            delattr(app.state, attr)

