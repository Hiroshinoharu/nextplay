from fastapi.testclient import TestClient

from services.recommender.main import app

client = TestClient(app)


# Test cases for GET /recommend/user/{user_id}
def test_get_recommend_for_user_valid_id_returns_expected_payload():
    response = client.get("/recommend/user/1")
    
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {'user_id', 'recommended_games', 'strategy'}
    assert body['user_id'] == 1
    assert body['recommended_games'] == [71, 72, 73, 74, 75]
    assert body['strategy'] == 'placeholder_user_based' 


def test_get_recommend_for_user_invalid_id_returns_400_with_clear_detail():
    response = client.get("/recommend/user/0")
    
    assert response.status_code == 400
    body = response.json()
    assert 'detail' in body
    assert body['detail'] == "Invalid user id"


def test_existing_recommend_item_and_recommend_routes_still_respond_as_expected():
    # Test GET /recommend/item/{item_id}
    item_response = client.get("/recommend/item/10")
    assert item_response.status_code == 200
    assert item_response.json() == {
        'item_id': 10,
        'similar_items': [11, 12, 13],
        'top_k': None,
        'filters': None,
    }
    
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
    assert recommend_response.json() == {
        'message': 'Recommendation placeholder response',
        'received': {
            'user_id': 1,
            'liked_keywords': [1, 2],
            'liked_platforms': [3],
            'disliked_keywords': [],
            'disliked_platforms': [4],
            'questionnaire': {'genre': 'strategy'}
        },
    }
    
    similar_post_response = client.post('/recommend/item', json={'item_id': 11, 'top_k': 5})
    assert similar_post_response.status_code == 200
    assert similar_post_response.json() == {
        'item_id': 11,
        'similar_items': [12, 13, 14, 15, 16],
        'top_k': 5,
        'filters': {}
    }

# Test that POST /recommend calls the inference service when available
def test_recommend_route_calls_inference_service_when_available():
    class _StubInference:
        def __init__(self):
            self.calls = []

        def infer(self, payload):
            self.calls.append(payload)
            return None

    stub = _StubInference()
    app.state.inference = stub

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