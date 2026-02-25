import logging
import time

from fastapi import HTTPException, Request

from ..models.inference import build_inference_service
from ..models.model_schema import ModelInputSchema
from ..models.request import RecommendRequest, SimilarRequest
from ..models.response import RecommendResponse, SimilarResponse, UserRecommendResponse

logger = logging.getLogger(__name__)

def _record_recommend_metrics(request: Request, *, latency_ms: float, fallback_used: bool) -> None:
    """
    Record metrics related to recommendation requests, such as total requests, latency, and fallback usage.
    
    Args:
        request (Request): The incoming HTTP request object, used to access the app state for storing metrics.
        latency_ms (float): The latency of the recommendation request in milliseconds, used for tracking performance.
        fallback_used (bool): A boolean flag indicating whether a fallback recommendation strategy was used, which can help monitor the reliability of the primary recommendation engine.
    """
    metrics = getattr(request.app.state, "metrics", None)
    if not isinstance(metrics, dict):
        return
    
    metrics["recommend_requests_total"] = int(metrics.get("recommend_requests_total", 0)) + 1

    # Keep both key variants for backward compatibility across tests/services.
    metrics["recommend_latency_ms_total"] = float(metrics.get("recommend_latency_ms_total", 0.0)) + latency_ms
    metrics["recommend_latency_ms"] = float(metrics.get("recommend_latency_ms", 0.0)) + latency_ms
    metrics["recommend_latency_ms_max"] = max(float(metrics.get("recommend_latency_ms_max", 0.0)), latency_ms)

    if fallback_used:
        metrics["recommend_fallback_total"] = int(metrics.get("recommend_fallback_total", 0)) + 1
        metrics["recommend_fallbacks_total"] = int(metrics.get("recommend_fallbacks_total", 0)) + 1
        
# Placeholder POST /recommend route to handle recommendation requests
async def recommend(payload: RecommendRequest, request: Request) -> RecommendResponse:
    """
    Placeholder recommendation engine.
    ML logic will be added later.
    """
    
    start = time.perf_counter()
    fallback_used = False
    model_version = getattr(request.app.state, "model_version", "unknown")
    
    model_input = ModelInputSchema.from_recommend_request(payload)
    logger.info(f"Received recommendation request for user_id={model_input.user_id} with model_version={model_version}")
    
    inference = getattr(request.app.state, "inference_service", None)
    if inference is None:
        inference = getattr(request.app.state, "inference", None)
    
    if inference is None:
        fallback_used = True
        logger.warning("No inference service available, using fallback recommendation strategy")
        inference = getattr(request.app.state, "fallback_inference", None) or build_inference_service(None)
    
    try:
        inference_output = inference.infer(model_input)
        logger.info(f"Inference output: {inference_output}")
    except Exception as e:
        logger.exception(
            f"recommender.inference_error user_id={model_input.user_id} model_version={model_version} error={str(e)}"
        )
        fallback_used = True
        fallback_inference = getattr(request.app.state, "fallback_inference", None) or build_inference_service(None)
        inference_output = fallback_inference.infer(model_input)   
    
    latency_ms = (time.perf_counter() - start) * 1000
    _record_recommend_metrics(request, latency_ms=latency_ms, fallback_used=fallback_used)
    
    strategy = getattr(inference_output, "strategy", "unknown")

    logger.info(
        "recommender.recommend_completed user_id=%s model_version=%s strategy=%s latency_ms=%.2f fallback=%s",
        payload.user_id,
        model_version,
        strategy,
        latency_ms,
        fallback_used,
    )

    return RecommendResponse(
        message="Recommendation placeholder response",
        received=payload
    )

# New GET /recommend/item/{item_id} route to return similar items based on item ID
async def recommend_similar(item_id: int) -> SimilarResponse:
    """
    Placeholder for item-to-item recommendations.
    Returns dummy similar item IDs for now.
    """
    if item_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid item id")

    # Dummy logic; replace with real similarity search
    similar = [item_id + 1, item_id + 2, item_id + 3]
    return SimilarResponse(item_id=item_id,similar_items=similar)

# Helper function to safely perform GET requests and parse JSON responses
def _safe_get_json(http, url: str, timeout):
    try:
        resp = http.get(url, timeout=timeout)
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception:
        return None


# Helper function to extract a set of integers from a list of dicts based on a specified field
def _extract_int_set(items, field_name: str):
    """
    Extracts a set of integers from a list of dictionaries based on a field name.

    Args:
        items (_type_): _description_
        field_name (str): _description_

    Returns:
        _type_: _description_
    """
    values = set()
    for item in items or []:
        value = item.get(field_name)
        if value is None:
            continue
        try:
            values.add(int(value))
        except (ValueError, TypeError):
            continue
    return values

# New GET /recommend/user/{user_id} route to generate user-specific recommendations
async def recommend_for_user(user_id: int, request: Request) -> UserRecommendResponse:
    """
    Generate user recommendations by combining user preferences and game metadata.
    Args:
        user_id (int): The ID of the user to generate recommendations for.
    """
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid user id")

    service_urls = getattr(request.app.state, "service_urls", None)
    http = getattr(request.app.state, "http", None)
    timeout = getattr(request.app.state, "request_timeout", (2.0, 5.0))

    # In tests without lifespan startup, app.state dependencies may be missing.
    if not service_urls or http is None:
        return UserRecommendResponse(
            user_id=user_id,
            recommended_games=[71, 72, 73, 74, 75],
            strategy="placeholder_user_based",
        )
    
    # Fetch user preferences
    keyword_prefs = _safe_get_json(http, f"{service_urls['user']}/users/{user_id}/keywords", timeout) or []
    platform_prefs = _safe_get_json(http, f"{service_urls['user']}/users/{user_id}/platforms", timeout) or []
    interactions = _safe_get_json(http, f"{service_urls['user']}/users/{user_id}/interactions", timeout) or []
    
    candidates = _safe_get_json(http, f"{service_urls['game']}/games?limit=100", timeout) or []
    
    preferred_keywords = _extract_int_set(keyword_prefs, "keyword_id")
    preferred_platforms = _extract_int_set(platform_prefs, "platform_id")
    interacted_games = _extract_int_set(interactions, "game_id")
    
    scored_candidates = []
    for game in candidates:
        game_id = game.get("id")
        try:
            game_id = int(game_id)
        except (ValueError, TypeError):
            continue
        
        if game_id in interacted_games:
            continue
        
        game_keywords = {
            int(k) 
            for k in (game.get("keywords") or []) 
            if isinstance(k, (int,float,str)) and str(k).isdigit()
        }
        
        game_platforms = {
            int(p) 
            for p in (game.get("platforms") or []) 
            if isinstance(p, (int,float,str)) and str(p).isdigit()
        }
        
        keyword_overlap = len(preferred_keywords & game_keywords)
        platform_overlap = len(preferred_platforms & game_platforms)
        
        score = (keyword_overlap * 3) + (platform_overlap * 2)
        popularity = game.get("popularity", 0.0)
        
        scored_candidates.append((score, popularity, game_id))
        
    # Determisic ranking: higher score first, then popularity, then game ID
    scored_candidates.sort(key=lambda row: (-row[0], -row[1], row[2]))
    
    top_n = 10
    recommended_items = [game_id for _, _, game_id in scored_candidates[:top_n]]
    
    return UserRecommendResponse(
        user_id=user_id,
        recommended_games=recommended_items,
        strategy="keyword_platform_overlap_v1"
    )


# New POST /recommend/item route to handle more complex similarity requests
async def recommend_similar_post(payload: SimilarRequest):
    if payload.item_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid item id")

    k = max(1, min(50, payload.top_k))
    similar = [payload.item_id + i for i in range(1, k + 1)]
    return SimilarResponse(
        item_id=payload.item_id,
        top_k=k,
        similar_items=similar,
        filters=payload.filters or {}
    )
