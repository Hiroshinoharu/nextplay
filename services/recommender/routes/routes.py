import hmac
import os

from fastapi import Depends, FastAPI, HTTPException, Request, status

from ..handlers.recommend import (
    recommend,
    recommend_for_user,
    recommend_similar,
    recommend_similar_post,
)
from ..models.response import SimilarResponse, UserRecommendResponse


def _expected_service_token() -> str:
    """
    Returns the expected service token, or an empty string if not configured.

    Service tokens can be set via the GATEWAY_SERVICE_TOKEN or SERVICE_TOKEN environment variables.
    """
    return (os.getenv("GATEWAY_SERVICE_TOKEN") or os.getenv("SERVICE_TOKEN") or "").strip()


async def require_service_token(request: Request) -> None:
    """
    Verify that the provided service token matches the expected one.

    If the expected service token is empty, raises a 500 error with
    detail "service auth not configured".

    If the provided token does not match the expected token, raises a 401 error
    with detail "unauthorized service token".
    """
    expected_token = _expected_service_token()
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="service auth not configured",
        )

    provided_token = request.headers.get("X-Service-Token", "").strip()
    if not hmac.compare_digest(provided_token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="unauthorized service token",
        )


def register_routes(app: FastAPI):
    """
    Registers the recommender routes on the given FastAPI app.

    Exposes the following routes:

    - `GET /health`: returns the status of the recommender service, including the model identity, ranking profile, and diagnostic rates.
    - `POST /recommend`: recommends items for the given user, taking into account the specified filters and ranking profile.
    - `GET /recommend/user/{user_id}`: recommends items for the given user, taking into account the specified filters and ranking profile.
    - `GET /recommend/item/{item_id}`: recommends similar items to the given item, taking into account the specified filters and ranking profile.
    - `POST /recommend/item`: recommends similar items to the given item, taking into account the specified filters and ranking profile.

    All routes are protected by the `require_service_token` dependency, which verifies the service token provided in the `X-Service-Token` header.
    """
    @app.get("/health")
    async def health(request: Request):
        """
        Returns the status of the recommender service, including the model identity, ranking profile, and diagnostic rates.

        Diagnostic rates include:

        - `fallback_rate`: the proportion of requests that fell back to the rule-based recommender.
        - `empty_result_rate`: the proportion of requests that returned an empty result.
        - `short_result_rate`: the proportion of requests that returned a short result (less than the requested number of items).
        - `repeated_result_rate`: the proportion of requests that returned a result with repeated items.

        The `metrics` key contains the raw request counters and diagnostic rates.

        Example response:
        {
            "service": "recommender",
            "status": "running",
            "model": "model_v1",
            "ranking_profile": "balanced_v1",
            "diagnostics": {
                "fallback_rate": 0.1,
                "empty_result_rate": 0.2,
                "short_result_rate": 0.3,
                "repeated_result_rate": 0.4,
                "metrics": {
                    "recommend_requests_total": 100,
                    "recommend_fallback_total": 10,
                    "recommend_empty_result_total": 20,
                    "recommend_short_result_total": 30,
                    "recommend_repeated_result_total": 40,
                },
            },
        }
        """
        metrics = getattr(request.app.state, "metrics", {}) or {}
        total_requests = int(metrics.get("recommend_requests_total", 0))
        fallback_total = int(metrics.get("recommend_fallback_total", 0))
        empty_total = int(metrics.get("recommend_empty_result_total", 0))
        short_total = int(metrics.get("recommend_short_result_total", 0))
        repeated_total = int(metrics.get("recommend_repeated_result_total", 0))
        return {
            "service": "recommender",
            "status": "running",
            "model": getattr(request.app.state, "loaded_model_identity", None),
            "ranking_profile": getattr(request.app.state, "ranking_profile", "balanced_v1"),
            "diagnostics": {
                "fallback_rate": (fallback_total / total_requests) if total_requests else 0.0,
                "empty_result_rate": (empty_total / total_requests) if total_requests else 0.0,
                "short_result_rate": (short_total / total_requests) if total_requests else 0.0,
                "repeated_result_rate": (repeated_total / total_requests) if total_requests else 0.0,
                "metrics": metrics,
            },
        }

    protected = [Depends(require_service_token)]

    app.post("/recommend", response_model=UserRecommendResponse, dependencies=protected)(recommend)
    app.get("/recommend/user/{user_id}", response_model=UserRecommendResponse, dependencies=protected)(recommend_for_user)
    app.get("/recommend/item/{item_id}", response_model=SimilarResponse, dependencies=protected)(recommend_similar)
    app.post("/recommend/item", response_model=SimilarResponse, dependencies=protected)(recommend_similar_post)
