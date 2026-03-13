from fastapi.testclient import TestClient
import pytest

from services.recommender.main import app
from services.recommender.handlers.recommend import (
    _extract_release_year_preference,
    _is_strict_release_year_preference,
    _release_era_alignment_score,
    _release_year_matches_preference,
)
from services.recommender.models.model_schema import ModelCandidateScore, ModelOutputSchema

client = TestClient(app)


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
    assert recommend_body["scored_recommendations"] == [
        {"game_id": 901, "rank": 1, "score": 0.95},
        {"game_id": 902, "rank": 2, "score": 0.9},
        {"game_id": 903, "rank": 3, "score": 0.85},
    ]
    
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

def test_recommend_for_user_live_dependencies_and_ranks_candidates():
    """
    This will test the recommend for user route 
    with live dependencies by mocking the HTTP responses 
    from the user and game services, and then asserting 
    that the response contains the expected recommended games 
    in the correct order based on keyword and platform overlap, and popularity as a tiebreaker.
    """
    app.state.service_urls = {
        "user": "http://user",
        "game": "http://game",
    }
    app.state.http = _HTTP(
        {
            "http://user/users/9/keywords": _Resp(200, [{"keyword_id": 4}, {"keyword_id": "bad"}]),
            "http://user/users/9/platforms": _Resp(200, [{"platform_id": 10}]),
            "http://user/users/9/interactions": _Resp(200, []),
            "http://game/games/top?limit=200": _Resp(
                200,
                [
                    {"id": 200, "keywords": [4], "platforms": [10], "popularity": 999.0},
                    {"id": 101, "keywords": [4], "platforms": [10], "popularity": 1.0},
                    {"id": 102, "keywords": [4], "platforms": [], "popularity": 10.0},
                    {"id": 103, "keywords": [], "platforms": [10], "popularity": 20.0},
                    {"id": 104, "keywords": [4], "platforms": [], "popularity": 10.0},
                ],
            ),
        }
    )
    
    response = client.get("/recommend/user/9")
    
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == 9
    assert body["recommended_games"] == [200, 101, 102, 104, 103]
    assert body["strategy"] == "keyword_platform_overlap_v1"
    assert body.get("scored_recommendations") == []
    
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
