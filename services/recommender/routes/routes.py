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
    return (os.getenv("GATEWAY_SERVICE_TOKEN") or os.getenv("SERVICE_TOKEN") or "").strip()


async def require_service_token(request: Request) -> None:
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
    @app.get("/health")
    async def health(request: Request):
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
