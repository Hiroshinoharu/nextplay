from fastapi.testclient import TestClient

from services.recommender.main import app


def test_health_route_remains_public() -> None:
    response = TestClient(app).get('/health')

    assert response.status_code == 200
    assert response.json()['service'] == 'recommender'


def test_recommend_routes_require_service_token() -> None:
    response = TestClient(app).get('/recommend/user/1')

    assert response.status_code == 401
    assert response.json() == {'detail': 'unauthorized service token'}
