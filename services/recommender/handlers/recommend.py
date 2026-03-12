import logging
import os
import time
from typing import Any

from fastapi import HTTPException, Request

from ..models.inference import build_inference_service
from ..models.model_schema import ModelInputSchema
from ..models.request import RecommendRequest, SimilarRequest
from ..models.response import SimilarResponse, UserRecommendResponse

logger = logging.getLogger(__name__)
RECOMMEND_TARGET_SIZE = 100


def _read_float_env(name: str, default: float, *, minimum: float = -100.0, maximum: float = 100.0) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        parsed = float(raw)
    except ValueError:
        return default
    return min(max(parsed, minimum), maximum)


# Hybrid ranking weights (tunable via environment variables).
RANK_WEIGHT_LIKED_KEYWORD = _read_float_env("RANK_WEIGHT_LIKED_KEYWORD", 4.0)
RANK_WEIGHT_LIKED_PLATFORM = _read_float_env("RANK_WEIGHT_LIKED_PLATFORM", 2.5)
RANK_WEIGHT_ANSWER_TOKEN = _read_float_env("RANK_WEIGHT_ANSWER_TOKEN", 1.6)
RANK_WEIGHT_FAVORITE_KEYWORD = _read_float_env("RANK_WEIGHT_FAVORITE_KEYWORD", 3.0)
RANK_WEIGHT_FAVORITE_PLATFORM = _read_float_env("RANK_WEIGHT_FAVORITE_PLATFORM", 1.8)
RANK_WEIGHT_FAVORITE_GENRE = _read_float_env("RANK_WEIGHT_FAVORITE_GENRE", 2.2)
RANK_WEIGHT_FAVORITE_TEXT_SIM = _read_float_env("RANK_WEIGHT_FAVORITE_TEXT_SIM", 6.5)
RANK_WEIGHT_DISLIKED_KEYWORD = _read_float_env("RANK_WEIGHT_DISLIKED_KEYWORD", 5.5)
RANK_WEIGHT_DISLIKED_PLATFORM = _read_float_env("RANK_WEIGHT_DISLIKED_PLATFORM", 4.0)
RANK_WEIGHT_MODEL_SEED_BOOST = _read_float_env("RANK_WEIGHT_MODEL_SEED_BOOST", 3.0)
RANK_WEIGHT_FAVORITE_SEED_BOOST = _read_float_env("RANK_WEIGHT_FAVORITE_SEED_BOOST", 6.0)
RANK_CAP_POPULARITY = _read_float_env("RANK_CAP_POPULARITY", 1.2)
RANK_CAP_RATING = _read_float_env("RANK_CAP_RATING", 1.0)


def _increment_metric(metrics: dict[str, int | float], key: str, amount: int | float = 1) -> None:
    existing = metrics.get(key, 0)
    if isinstance(amount, float):
        metrics[key] = float(existing) + amount
    else:
        metrics[key] = int(existing) + amount


def _record_named_metric(request: Request, key: str, amount: int | float = 1) -> None:
    metrics = getattr(request.app.state, "metrics", None)
    if not isinstance(metrics, dict):
        return
    _increment_metric(metrics, key, amount)


def _record_recommend_metrics(
    request: Request,
    *,
    latency_ms: float,
    fallback_used: bool,
    error_occurred: bool,
    outcome: str,
    fallback_reason: str | None,
) -> None:
    metrics = getattr(request.app.state, "metrics", None)
    if not isinstance(metrics, dict):
        return

    _increment_metric(metrics, "recommend_requests_total")

    # Keep both key variants for backward compatibility across tests/services.
    _increment_metric(metrics, "recommend_latency_ms_total", latency_ms)
    _increment_metric(metrics, "recommend_latency_ms", latency_ms)
    metrics["recommend_latency_ms_max"] = max(float(metrics.get("recommend_latency_ms_max", 0.0)), latency_ms)

    if fallback_used:
        _increment_metric(metrics, "recommend_fallback_total")
        _increment_metric(metrics, "recommend_fallbacks_total")

    if error_occurred:
        # Keep both key variants for backward compatibility across tests/services.
        _increment_metric(metrics, "recommend_errors_total")
        _increment_metric(metrics, "recommend_error_total")

    _increment_metric(metrics, f"recommend_outcome_{outcome}_total")
    if fallback_reason:
        _increment_metric(metrics, f"recommend_fallback_reason_{fallback_reason}_total")


def _safe_get_json(http, url: str, timeout):
    try:
        resp = http.get(url, timeout=timeout)
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception:
        return None


def _safe_get_json_with_status(http, url: str, timeout) -> tuple[int | None, Any | None]:
    try:
        resp = http.get(url, timeout=timeout)
        if resp.status_code != 200:
            return resp.status_code, None
        return resp.status_code, resp.json()
    except Exception:
        return None, None


def _normalize_int(value: Any) -> int | None:
    """
    Attempts to convert `value` to an integer. If the conversion is unsuccessful,
    returns `None`.

    :param value: The value to convert to an integer.
    :type value: Any
    :return: The converted integer, or `None` if unsuccessful.
    :rtype: int | None
    """
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _extract_game_id(game: dict[str, Any]) -> int | None:
    """
    Attempts to extract the game ID from a game dictionary.

    :param game: The game dictionary to extract the ID from.
    :type game: dict[str, Any]
    :return: The extracted game ID, or `None` if unsuccessful.
    :rtype: int | None
    """
    return _normalize_int(game.get("id"))


def _extract_number(game: dict[str, Any], field: str) -> float:
    value = game.get(field, 0.0)
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def _normalize_primary_genre(value: Any) -> str:
    """
    Normalizes a primary genre string.

    This function takes a value and returns its normalized primary genre string.
    The normalization process involves stripping the value, splitting it by commas,
    taking the first element, stripping it again, and finally converting it to
    lowercase.

    :param value: The value to normalize.
    :type value: Any
    :return: The normalized primary genre string.
    :rtype: str
    """
    raw = str(value or "").strip()
    if not raw:
        return ""
    return raw.split(",")[0].strip().lower()


def _tokenize_game_text(game: dict[str, Any]) -> set[str]:
    """
    Tokenizes game text into a set of strings.

    This function takes a game dictionary and returns a set of strings.
    The strings are generated by joining the name, genre, description, and story
    fields of the game dictionary, converting the result to lowercase, and
    then splitting the result into individual words. Words that are less than
    3 characters long or that are in the stop_words set are not included in
    the result.

    Args:
        game (dict[str, Any]): A game dictionary

    Returns:
        set[str]: A set of strings
    """
    stop_words = {
        "the",
        "and",
        "for",
        "with",
        "edition",
        "ultimate",
        "complete",
        "deluxe",
        "game",
    }
    text = " ".join(
        [
            str(game.get("name") or ""),
            str(game.get("genre") or ""),
            str(game.get("description") or ""),
            str(game.get("story") or ""),
        ]
    ).lower()

    tokens = set()
    current: list[str] = []
    for ch in text:
        if ch.isalnum():
            current.append(ch)
            continue
        if current:
            token = "".join(current)
            if len(token) >= 3 and token not in stop_words:
                tokens.add(token)
            current = []
    if current:
        token = "".join(current)
        if len(token) >= 3 and token not in stop_words:
            tokens.add(token)

    return tokens


def _jaccard_similarity(left: set[str], right: set[str]) -> float:
    """
    Compute the Jaccard similarity between two sets of strings.

    The Jaccard similarity is the size of the intersection divided by the size of the union of the two sets.

    If either set is empty, the function returns 0.0.

    :param left: The first set of strings
    :param right: The second set of strings
    :return: The Jaccard similarity between the two sets
    :rtype: float
    """
    if not left or not right:
        return 0.0
    union = left | right
    if not union:
        return 0.0
    return float(len(left & right)) / float(len(union))


def _rank_similar_items(
    seed_game: dict[str, Any],
    candidates: list[dict[str, Any]],
    *,
    top_k: int,
) -> list[int]:
    """
    Rank a list of game candidates based on their similarity to a seed game.

    The ranking is based on a combination of text similarity (Jaccard similarity of tokenized game text)
    and genre bonus (0.20 if the primary genre matches). Popularity is also taken into account.

    :param seed_game: the game to rank candidates against
    :param candidates: a list of game dictionaries to rank
    :param top_k: the number of top ranked candidates to return
    :return: a list of game IDs representing the top ranked candidates
    """
    seed_id = _extract_game_id(seed_game)
    seed_tokens = _tokenize_game_text(seed_game)
    seed_genre = _normalize_primary_genre(seed_game.get("genre"))

    scored_rows: list[tuple[float, float, int]] = []
    seen: set[int] = set()
    for candidate in candidates:
        game_id = _extract_game_id(candidate)
        if game_id is None or game_id == seed_id or game_id in seen:
            continue
        seen.add(game_id)

        candidate_tokens = _tokenize_game_text(candidate)
        text_similarity = _jaccard_similarity(seed_tokens, candidate_tokens)
        genre_bonus = 0.20 if seed_genre and _normalize_primary_genre(candidate.get("genre")) == seed_genre else 0.0
        popularity = _extract_number(candidate, "popularity")
        score = text_similarity + genre_bonus + min(max(popularity, 0.0) / 1000.0, 0.20)
        scored_rows.append((score, popularity, game_id))

    scored_rows.sort(key=lambda row: (-row[0], -row[1], row[2]))
    return [game_id for _, _, game_id in scored_rows[:top_k]]


def _merge_game_lists(*lists: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Merge multiple lists of game dictionaries into a single list while preserving uniqueness based on game ID.

    :param lists: a variable number of lists of game dictionaries
    :return: a list of game dictionaries with no duplicates
    """
    
    merged: list[dict[str, Any]] = []
    seen: set[int] = set()
    for games in lists:
        for game in games or []:
            game_id = _extract_game_id(game)
            if game_id is None or game_id in seen:
                continue
            seen.add(game_id)
            merged.append(game)
    return merged


def _popularity_diversity_baseline(
    candidates: list[dict[str, Any]],
    *,
    top_n: int,
    excluded_ids: set[int] | None = None,
) -> list[int]:
    """
    Generates a popularity and diversity baseline ranking for the given candidates.

    The baseline ranking is computed in two passes. The first pass selects the top games by popularity and diversity of genres.
    The second pass fills the remaining slots by popularity to ensure that the final ranking has the desired number of games.

    :param candidates: a list of game dictionaries
    :param top_n: the desired number of games in the final ranking
    :param excluded_ids: a set of game IDs to exclude from the ranking
    :return: a list of game IDs representing the baseline ranking
    """
    excluded = excluded_ids or set()
    ranked = sorted(
        candidates or [],
        key=lambda game: (
            -_extract_number(game, "popularity"),
            -_extract_number(game, "aggregated_rating"),
            _extract_game_id(game) or 0,
        ),
    )

    picked: list[int] = []
    used_genres: set[str] = set()

    # First pass: maximize genre diversity.
    for game in ranked:
        game_id = _extract_game_id(game)
        if game_id is None or game_id in excluded:
            continue
        genre = _normalize_primary_genre(game.get("genre"))
        if genre and genre in used_genres:
            continue
        picked.append(game_id)
        if genre:
            used_genres.add(genre)
        if len(picked) >= top_n:
            return picked

    # Second pass: fill remaining slots by popularity.
    for game in ranked:
        game_id = _extract_game_id(game)
        if game_id is None or game_id in excluded or game_id in picked:
            continue
        picked.append(game_id)
        if len(picked) >= top_n:
            break

    return picked


def _extract_int_set(items, field_name: str):
    """
    Extracts a set of integers from a list of dictionaries.

    :param items: a list of dictionaries
    :param field_name: the name of the field to extract from each dictionary
    :return: a set of integers
    """
    values = set()
    for item in items or []:
        if not isinstance(item, dict):
            continue
        value = item.get(field_name)
        if value is None:
            continue
        try:
            values.add(int(value))
        except (ValueError, TypeError):
            continue
    return values

def _to_int_set(values: Any) -> set[int]:
    """
    Converts an iterable of values into a set of integers.

    Args:
        values: An iterable of values to convert.

    Returns:
        A set of integers containing the converted values.
    """
    normalized: set[int] = set()
    if not isinstance(values, list):
        return normalized
    for value in values:
        try:
            normalized.add(int(value))
        except (ValueError, TypeError):
            continue
    return normalized


def _fetch_user_interacted_game_ids(request: Request, user_id: int) -> set[int]:
    """
    Fetch game IDs the user already interacted with.

    Returns an empty set when dependencies are unavailable.
    """
    if user_id <= 0:
        return set()

    service_urls = getattr(request.app.state, "service_urls", None)
    http = getattr(request.app.state, "http", None)
    timeout = getattr(request.app.state, "request_timeout", (2.0, 5.0))
    if not service_urls or http is None:
        return set()

    user_url = service_urls.get("user")
    if not user_url:
        return set()

    status, payload = _safe_get_json_with_status(http, f"{user_url}/users/{user_id}/interactions", timeout)
    if status != 200 or not isinstance(payload, list):
        return set()
    return _extract_int_set(payload, "game_id")


def _build_favorite_profile(
    request: Request,
    favorite_game_ids: list[int],
) -> tuple[set[int], set[int], set[str], list[set[str]]]:
    """
    Build a lightweight profile from favorite games so favorites can directly
    influence downstream ranking (keywords/platforms/genre/text).
    """
    service_urls = getattr(request.app.state, "service_urls", None)
    http = getattr(request.app.state, "http", None)
    timeout = getattr(request.app.state, "request_timeout", (2.0, 5.0))
    if not service_urls or http is None:
        return set(), set(), set(), []

    game_url = service_urls.get("game")
    if not game_url:
        return set(), set(), set(), []

    unique_favorite_ids: list[int] = []
    seen_ids: set[int] = set()
    for raw_id in favorite_game_ids[:3]:
        normalized_id = _normalize_int(raw_id)
        if normalized_id is None or normalized_id <= 0 or normalized_id in seen_ids:
            continue
        seen_ids.add(normalized_id)
        unique_favorite_ids.append(normalized_id)

    favorite_keyword_ids: set[int] = set()
    favorite_platform_ids: set[int] = set()
    favorite_genres: set[str] = set()
    favorite_token_sets: list[set[str]] = []
    for game_id in unique_favorite_ids:
        status, payload = _safe_get_json_with_status(
            http,
            f"{game_url}/games/{game_id}",
            timeout,
        )
        if status != 200 or not isinstance(payload, dict):
            continue
        favorite_keyword_ids |= _to_int_set(payload.get("keywords"))
        favorite_platform_ids |= _to_int_set(payload.get("platforms"))
        favorite_genre = _normalize_primary_genre(payload.get("genre"))
        if favorite_genre:
            favorite_genres.add(favorite_genre)
        tokens = _tokenize_game_text(payload)
        if tokens:
            favorite_token_sets.append(tokens)

    return favorite_keyword_ids, favorite_platform_ids, favorite_genres, favorite_token_sets


def _build_personalized_recommendation_ids(
    request: Request,
    *,
    liked_keyword_ids: set[int],
    liked_platform_ids: set[int],
    disliked_keyword_ids: set[int],
    disliked_platform_ids: set[int],
    favorite_game_ids: list[int],
    answer_tokens: set[str],
    favorite_seed_ids: list[int],
    model_seed_ids: list[int],
    top_n: int,
    excluded_game_ids: set[int] | None = None,
) -> list[int]:
    """
    Build a larger personalized recommendation list by scoring game-service
    candidates using questionnaire preference overlap, with optional seed boosts.
    """
    candidates = _fetch_candidate_games_for_user(request, limit=max(200, top_n * 10))
    if not candidates:
        return []

    favorite_seed_rank = {game_id: index for index, game_id in enumerate(favorite_seed_ids, start=1)}
    model_seed_rank = {
        game_id: index
        for index, game_id in enumerate(model_seed_ids, start=1)
        if game_id not in favorite_seed_rank
    }
    favorite_ids = _to_int_set(favorite_game_ids)
    excluded = set(excluded_game_ids or set())
    excluded |= favorite_ids
    (
        favorite_keyword_ids,
        favorite_platform_ids,
        favorite_genres,
        favorite_token_sets,
    ) = _build_favorite_profile(request, favorite_game_ids)
    scored_rows: list[tuple[float, float, int]] = []
    for game in candidates:
        game_id = _extract_game_id(game)
        if game_id is None:
            continue
        if game_id in excluded:
            continue

        game_keywords = _to_int_set(game.get("keywords"))
        game_platforms = _to_int_set(game.get("platforms"))
        game_text_tokens = _tokenize_game_text(game)

        liked_keyword_overlap = len(liked_keyword_ids & game_keywords)
        liked_platform_overlap = len(liked_platform_ids & game_platforms)
        disliked_keyword_overlap = len(disliked_keyword_ids & game_keywords)
        disliked_platform_overlap = len(disliked_platform_ids & game_platforms)
        answer_token_overlap = len(answer_tokens & game_text_tokens) if answer_tokens else 0
        favorite_keyword_overlap = len(favorite_keyword_ids & game_keywords)
        favorite_platform_overlap = len(favorite_platform_ids & game_platforms)
        favorite_genre_match = 1 if _normalize_primary_genre(game.get("genre")) in favorite_genres else 0
        favorite_text_similarity = (
            max((_jaccard_similarity(game_text_tokens, token_set) for token_set in favorite_token_sets), default=0.0)
            if game_text_tokens
            else 0.0
        )

        # Skip strongly mismatched items unless they were model-seeded.
        if (
            disliked_keyword_overlap + disliked_platform_overlap > 0
            and liked_keyword_overlap + liked_platform_overlap == 0
            and game_id not in favorite_seed_rank
            and game_id not in model_seed_rank
        ):
            continue

        popularity = _extract_number(game, "popularity")
        rating = _extract_number(game, "aggregated_rating")
        score = 0.0
        score += liked_keyword_overlap * RANK_WEIGHT_LIKED_KEYWORD
        score += liked_platform_overlap * RANK_WEIGHT_LIKED_PLATFORM
        score += answer_token_overlap * RANK_WEIGHT_ANSWER_TOKEN
        score += favorite_keyword_overlap * RANK_WEIGHT_FAVORITE_KEYWORD
        score += favorite_platform_overlap * RANK_WEIGHT_FAVORITE_PLATFORM
        score += favorite_genre_match * RANK_WEIGHT_FAVORITE_GENRE
        score += favorite_text_similarity * RANK_WEIGHT_FAVORITE_TEXT_SIM
        score -= disliked_keyword_overlap * RANK_WEIGHT_DISLIKED_KEYWORD
        score -= disliked_platform_overlap * RANK_WEIGHT_DISLIKED_PLATFORM
        score += min(max(popularity, 0.0) / 1000.0, RANK_CAP_POPULARITY)
        score += min(max(rating, 0.0) / 100.0, RANK_CAP_RATING)

        if game_id in favorite_seed_rank:
            score += RANK_WEIGHT_FAVORITE_SEED_BOOST / float(favorite_seed_rank[game_id])
        elif game_id in model_seed_rank:
            score += RANK_WEIGHT_MODEL_SEED_BOOST / float(model_seed_rank[game_id])

        scored_rows.append((score, popularity, game_id))

    if not scored_rows:
        return []

    scored_rows.sort(key=lambda row: (-row[0], -row[1], row[2]))

    diverse: list[int] = []
    diverse_set: set[int] = set()
    genre_counts: dict[str, int] = {}
    game_by_id: dict[int, dict[str, Any]] = {
        gid: game for game in candidates if (gid := _extract_game_id(game)) is not None
    }
    token_by_id: dict[int, set[str]] = {
        gid: _tokenize_game_text(game) for gid, game in game_by_id.items()
    }
    ranked_ids = [game_id for _, _, game_id in scored_rows]
    max_per_genre = max(2, min(4, top_n // 6 + 1))

    # First pass: enforce genre caps and avoid near-duplicate text matches.
    for game_id in ranked_ids:
        game = game_by_id.get(game_id)
        if game is None:
            continue
        genre = _normalize_primary_genre(game.get("genre"))
        if genre and genre_counts.get(genre, 0) >= max_per_genre:
            continue
        candidate_tokens = token_by_id.get(game_id, set())
        if candidate_tokens and any(
            _jaccard_similarity(candidate_tokens, token_by_id.get(existing_id, set())) >= 0.72
            for existing_id in diverse
        ):
            continue
        diverse.append(game_id)
        diverse_set.add(game_id)
        if genre:
            genre_counts[genre] = genre_counts.get(genre, 0) + 1
        if len(diverse) >= top_n:
            break

    # Second pass: relaxed similarity threshold to fill while keeping variety.
    for game_id in ranked_ids:
        if game_id in diverse_set:
            continue
        candidate_tokens = token_by_id.get(game_id, set())
        if candidate_tokens and any(
            _jaccard_similarity(candidate_tokens, token_by_id.get(existing_id, set())) >= 0.86
            for existing_id in diverse
        ):
            continue
        diverse.append(game_id)
        diverse_set.add(game_id)
        if len(diverse) >= top_n:
            break

    # Final pass: backfill any remaining slots by score.
    for game_id in ranked_ids:
        if game_id in diverse_set:
            continue
        diverse.append(game_id)
        if len(diverse) >= top_n:
            break

    return diverse[:top_n]

def _extract_questionnaire_answer_tokens(questionnaire: dict[str, Any]) -> set[str]:
    tokens: set[str] = set()
    answers = questionnaire.get("answers")
    if not isinstance(answers, dict):
        return tokens

    stop_words = {"preference", "preferences", "primary", "mode", "content", "level"}
    for selected in answers.values():
        if not isinstance(selected, list):
            continue
        for value in selected:
            if not isinstance(value, str):
                continue
            for chunk in value.replace("-", "_").split("_"):
                token = chunk.strip().lower()
                if len(token) < 3 or token in stop_words:
                    continue
                tokens.add(token)
    return tokens


def _fetch_candidate_games_for_user(request: Request, *, limit: int = 200) -> list[dict[str, Any]]:
    """
    Fetch a list of candidate games for a given user.

    Tries to fetch top games or all games from the game service, and returns the first successful response.

    :param request: the active FastAPI request object
    :param limit: the number of games to fetch (default: 200)
    :return: a list of game dictionaries
    """
    
    service_urls = getattr(request.app.state, "service_urls", None)
    http = getattr(request.app.state, "http", None)
    timeout = getattr(request.app.state, "request_timeout", (2.0, 5.0))
    if not service_urls or http is None:
        return []

    for url in (
        f"{service_urls['game']}/games/top?limit={limit}",
        f"{service_urls['game']}/games?limit={limit}",
    ):
        status, payload = _safe_get_json_with_status(http, url, timeout)
        if status == 200 and isinstance(payload, list):
            return payload

    return []

def _build_non_placeholder_fallback_ids(request: Request, *, top_n: int = 10) -> list[int]:
    """
    Build a dynamic fallback recommendation list from game-service candidates.

    Returns an empty list when dependencies are unavailable so callers can keep
    existing fallback behavior.
    """
    candidates = _fetch_candidate_games_for_user(request, limit=max(50, top_n * 20))
    if not candidates:
        return []
    return _popularity_diversity_baseline(candidates, top_n=top_n)


def _fetch_item_similarity_pool(
    request: Request,
    *,
    item_id: int,
    top_k: int,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """
    Fetch a pool of similar items for a given item ID.

    Returns a tuple containing the requested item's metadata and a list of
    similar items. The similar items list is a combination of the item's
    related content and search results for the item's name.

    :param request: the active FastAPI request object
    :param item_id: the ID of the item to fetch similar items for
    :param top_k: the number of similar items to fetch
    :return: a tuple containing the item's metadata and a list of similar items
    :raises HTTPException: if the recommendation dependencies are unavailable or if the item metadata cannot be fetched
    """
    service_urls = getattr(request.app.state, "service_urls", None)
    http = getattr(request.app.state, "http", None)
    timeout = getattr(request.app.state, "request_timeout", (2.0, 5.0))
    if not service_urls or http is None:
        raise HTTPException(status_code=503, detail="Recommendation dependencies unavailable")

    status_seed, seed_payload = _safe_get_json_with_status(http, f"{service_urls['game']}/games/{item_id}", timeout)
    if status_seed == 404:
        raise HTTPException(status_code=404, detail="Item not found")
    if status_seed != 200 or not isinstance(seed_payload, dict):
        raise HTTPException(status_code=502, detail="Failed to load item metadata")

    related_limit = max(80, min(200, top_k * 8))
    _, related_payload = _safe_get_json_with_status(
        http,
        f"{service_urls['game']}/games/{item_id}/related-content?limit={related_limit}",
        timeout,
    )
    related_candidates = related_payload if isinstance(related_payload, list) else []

    seed_name = str(seed_payload.get("name") or "").strip()
    search_candidates: list[dict[str, Any]] = []
    if seed_name:
        _, search_payload = _safe_get_json_with_status(
            http,
            f"{service_urls['game']}/games/search?q={seed_name}&mode=contains&limit=120",
            timeout,
        )
        if isinstance(search_payload, list):
            search_candidates = search_payload

    return seed_payload, _merge_game_lists(related_candidates, search_candidates)


def _expand_favorite_seed_ids(
    request: Request,
    *,
    favorite_game_ids: list[int],
    top_k_per_game: int = 20,
) -> list[int]:
    """
    Build seed IDs from a user's favorite games by retrieving nearby similar items.

    Returns ordered unique IDs where the original favorites come first, followed
    by ranked similar candidates for each favorite.
    """
    ordered: list[int] = []
    seen: set[int] = set()

    for raw_id in favorite_game_ids[:3]:
        try:
            game_id = int(raw_id)
        except (ValueError, TypeError):
            continue
        if game_id <= 0 or game_id in seen:
            continue
        seen.add(game_id)
        ordered.append(game_id)

    for game_id in list(ordered):
        try:
            seed_game, candidate_pool = _fetch_item_similarity_pool(
                request,
                item_id=game_id,
                top_k=top_k_per_game,
            )
            similar_ids = _rank_similar_items(
                seed_game,
                candidate_pool,
                top_k=top_k_per_game,
            )
        except HTTPException:
            continue
        except Exception:
            continue

        for similar_id in similar_ids:
            if similar_id in seen:
                continue
            seen.add(similar_id)
            ordered.append(similar_id)

    return ordered


# POST /recommend
async def recommend(payload: RecommendRequest, request: Request) -> UserRecommendResponse:
    """
    Returns a personalized list of game recommendations for the given user.

    The response will contain a list of up to 100 recommended games, along with a strategy indicating how the recommendations were generated.

    The strategy can be one of the following:
    - "model_inference_success": The recommendations were generated using a machine learning model.
    - "model_inference_failure_with_fallback": The recommendations were generated using a machine learning model, but the model failed to produce candidates and a fallback was used.
    - "fallback_only_mode": No machine learning model was available, and the recommendations were generated using a fallback only.
    - "hybrid_model_profile_v1": The recommendations were generated using a combination of a machine learning model and user profile information.
    - "hybrid_profile_fallback_v1": The recommendations were generated using a combination of a machine learning model, user profile information, and a fallback when the model failed to produce candidates.
    - "popularity_diversity_v1": The recommendations were generated using a popularity and diversity based fallback.

    The response will also contain a latency in milliseconds, indicating how long the recommendation generation took.

    The request_id, user_id, model_version, and outcome will be logged for traceability.

    The fallback_reason will be logged if the recommendations were generated using a fallback.

    The latency_ms will be logged for performance monitoring.

    The recommendation generation will record metrics for the following outcomes:
    - "recommend_outcome_model_inference_success_total"
    - "recommend_outcome_model_inference_failure_with_fallback_total"
    - "recommend_outcome_fallback_only_mode_total"
    - "recommend_fallback_reason_load_failure_total"
    - "recommend_fallback_reason_inference_exception_total"
    - "recommend_fallback_reason_empty_candidates_total"
    - "recommend_fallback_reason_no_model_loaded_total"
    - "recommend_fallback_reason_missing_inference_service_total"
    - "recommend_latency_ms_total"
    - "recommend_latency_ms_max"
    - "recommend_error_total"
    - "recommend_fallback_total"
    - "recommend_fallbacks_total"
    """
    start = time.perf_counter()
    fallback_used = False
    error_occurred = False
    fallback_reason: str | None = None
    outcome = "model_inference_success"
    model_version = getattr(request.app.state, "model_version", "unknown")
    request_id = getattr(request.state, "request_id", "unknown")

    if payload.user_id is None:
        raise HTTPException(status_code=400, detail="user_id is required for /recommend")

    model_input = ModelInputSchema.from_recommend_request(payload)
    logger.info(
        "request_id=%s recommender.request user_id=%s model_version=%s",
        request_id,
        model_input.user_id,
        model_version,
    )

    inference = getattr(request.app.state, "inference_service", None)
    if inference is None:
        inference = getattr(request.app.state, "inference", None)

    model_loaded = getattr(request.app.state, "model", None) is not None
    model_load_failed = bool(getattr(request.app.state, "model_load_failed", False))
    model_mode = "model" if model_loaded else "fallback_only"

    fallback_inference = getattr(request.app.state, "fallback_inference", None) or build_inference_service(None)

    if not model_loaded:
        fallback_used = True
        outcome = "fallback_only_mode"
        fallback_reason = "load_failure" if model_load_failed else "no_model_loaded"
        logger.info(
            "request_id=%s recommender.fallback_only_mode user_id=%s model_version=%s reason=%s",
            request_id,
            model_input.user_id,
            model_version,
            fallback_reason,
        )

    if inference is None:
        fallback_used = True
        outcome = "fallback_only_mode"
        fallback_reason = "missing_inference_service"
        logger.warning(
            "request_id=%s recommender.fallback_only_mode user_id=%s model_version=%s reason=%s",
            request_id,
            model_input.user_id,
            model_version,
            fallback_reason,
        )
        inference = fallback_inference

    try:
        inference_output = inference.infer(model_input)
        if model_mode == "model" and not inference_output.candidates:
            fallback_used = True
            outcome = "model_inference_failure_with_fallback"
            fallback_reason = "empty_candidates"
            logger.warning(
                "request_id=%s recommender.inference_failure_fallback user_id=%s model_version=%s reason=%s",
                request_id,
                model_input.user_id,
                model_version,
                fallback_reason,
            )
            inference_output = fallback_inference.infer(model_input)
        elif model_mode == "model":
            logger.info(
                "request_id=%s recommender.inference_success user_id=%s model_version=%s strategy=%s candidates=%s",
                request_id,
                model_input.user_id,
                model_version,
                inference_output.strategy,
                len(inference_output.candidates),
            )
    except Exception as exc:
        logger.exception(
            "request_id=%s recommender.inference_error user_id=%s model_version=%s error=%s",
            request_id,
            model_input.user_id,
            model_version,
            str(exc),
        )
        if model_mode == "model":
            fallback_used = True
            error_occurred = True
            outcome = "model_inference_failure_with_fallback"
            fallback_reason = "inference_exception"
            logger.warning(
                "request_id=%s recommender.inference_failure_fallback user_id=%s model_version=%s reason=%s",
                request_id,
                model_input.user_id,
                model_version,
                fallback_reason,
            )
            inference_output = fallback_inference.infer(model_input)
        else:
            error_occurred = True
            outcome = "fallback_only_mode"
            fallback_reason = fallback_reason or "fallback_inference_exception"
            raise

    latency_ms = (time.perf_counter() - start) * 1000
    _record_recommend_metrics(
        request,
        latency_ms=latency_ms,
        fallback_used=fallback_used,
        error_occurred=error_occurred,
        outcome=outcome,
        fallback_reason=fallback_reason,
    )

    strategy = getattr(inference_output, "strategy", "unknown")
    logger.info(
        "request_id=%s recommender.recommend_completed user_id=%s model_version=%s strategy=%s outcome=%s fallback_reason=%s latency_ms=%.2f fallback=%s",
        request_id,
        model_input.user_id,
        model_version,
        strategy,
        outcome,
        fallback_reason or "none",
        latency_ms,
        fallback_used,
    )

    model_seed_ids = [candidate.game_id for candidate in getattr(inference_output, "candidates", [])]
    favorite_seed_ids = _expand_favorite_seed_ids(
        request,
        favorite_game_ids=model_input.favorite_game_ids,
        top_k_per_game=20,
    )
    answer_tokens = _extract_questionnaire_answer_tokens(model_input.questionnaire)
    interacted_game_ids = _fetch_user_interacted_game_ids(request, int(model_input.user_id or 0))
    personalized_ids = _build_personalized_recommendation_ids(
        request,
        liked_keyword_ids=set(model_input.liked_keyword_ids),
        liked_platform_ids=set(model_input.liked_platform_ids),
        disliked_keyword_ids=set(model_input.disliked_keyword_ids),
        disliked_platform_ids=set(model_input.disliked_platform_ids),
        favorite_game_ids=model_input.favorite_game_ids,
        answer_tokens=answer_tokens,
        favorite_seed_ids=favorite_seed_ids,
        model_seed_ids=model_seed_ids,
        top_n=RECOMMEND_TARGET_SIZE,
        excluded_game_ids=interacted_game_ids,
    )
    if personalized_ids:
        strategy = (
            "hybrid_model_profile_v1"
            if getattr(inference_output, "strategy", "") != "rule_based_fallback_v1"
            else "hybrid_profile_fallback_v1"
        )
        logger.info(
            "request_id=%s recommender.hybrid_personalization_applied user_id=%s strategy=%s candidates=%s",
            request_id,
            model_input.user_id,
            strategy,
            len(personalized_ids),
        )
        return UserRecommendResponse(
            user_id=model_input.user_id,
            recommended_games=personalized_ids,
            strategy=strategy,
        )

    if getattr(inference_output, "strategy", "") == "rule_based_fallback_v1":
        dynamic_fallback_ids = _build_non_placeholder_fallback_ids(
            request, top_n=RECOMMEND_TARGET_SIZE
        )
        if dynamic_fallback_ids:
            logger.info(
                "request_id=%s recommender.dynamic_fallback_applied user_id=%s strategy=popularity_diversity_v1 candidates=%s",
                request_id,
                model_input.user_id,
                len(dynamic_fallback_ids),
            )
            return UserRecommendResponse(
                user_id=model_input.user_id,
                recommended_games=dynamic_fallback_ids,
                strategy="popularity_diversity_v1",
            )

    return inference_output.to_user_recommend_response(fallback_user_id=model_input.user_id)


# GET /recommend/user/{user_id}
async def recommend_for_user(user_id: int, request: Request) -> UserRecommendResponse:
    """
    GET /recommend/user/{user_id}

    Recommend games for a given user.

    If the user has no associated keywords or platforms, returns a cold start response
    based on popularity and diversity.

    If the user has associated keywords or platforms, returns a personalized response
    based on keyword and platform overlap with game data.

    Args:
        user_id (int): The user ID to generate recommendations for.

    Returns:
        UserRecommendResponse: A response containing the recommended games and the strategy used.
    """
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid user id")

    _record_named_metric(request, "recommend_user_requests_total")

    service_urls = getattr(request.app.state, "service_urls", None)
    http = getattr(request.app.state, "http", None)
    timeout = getattr(request.app.state, "request_timeout", (2.0, 5.0))

    # Backward-compatible deterministic payload in test mode only.
    if not service_urls or http is None:
        if os.getenv("PYTEST_CURRENT_TEST"):
            return UserRecommendResponse(
                user_id=user_id,
                recommended_games=[71, 72, 73, 74, 75],
                strategy="placeholder_user_based",
            )

        baseline_candidates = _fetch_candidate_games_for_user(request, limit=200)
        baseline_ids = _popularity_diversity_baseline(baseline_candidates, top_n=10)
        _record_named_metric(request, "recommend_user_cold_start_total")
        _record_named_metric(request, "recommend_user_strategy_popularity_diversity_v1_total")
        return UserRecommendResponse(
            user_id=user_id,
            recommended_games=baseline_ids,
            strategy="popularity_diversity_v1",
        )

    status_keywords, keyword_payload = _safe_get_json_with_status(http, f"{service_urls['user']}/users/{user_id}/keywords", timeout)
    status_platforms, platform_payload = _safe_get_json_with_status(http, f"{service_urls['user']}/users/{user_id}/platforms", timeout)
    status_interactions, interactions_payload = _safe_get_json_with_status(http, f"{service_urls['user']}/users/{user_id}/interactions", timeout)
    candidates = _fetch_candidate_games_for_user(request, limit=200)

    user_data_available = (
        status_keywords == 200
        and status_platforms == 200
        and status_interactions == 200
        and isinstance(keyword_payload, list)
        and isinstance(platform_payload, list)
        and isinstance(interactions_payload, list)
    )
    if not user_data_available:
        _record_named_metric(request, "recommend_user_cold_start_total")
        _record_named_metric(request, "recommend_user_strategy_popularity_diversity_v1_total")
        return UserRecommendResponse(
            user_id=user_id,
            recommended_games=_popularity_diversity_baseline(candidates, top_n=10),
            strategy="popularity_diversity_v1",
        )

    preferred_keywords = _extract_int_set(keyword_payload, "keyword_id")
    preferred_platforms = _extract_int_set(platform_payload, "platform_id")
    interacted_games = _extract_int_set(interactions_payload, "game_id")

    if not preferred_keywords and not preferred_platforms:
        _record_named_metric(request, "recommend_user_cold_start_total")
        _record_named_metric(request, "recommend_user_strategy_popularity_diversity_v1_total")
        return UserRecommendResponse(
            user_id=user_id,
            recommended_games=_popularity_diversity_baseline(candidates, top_n=10, excluded_ids=interacted_games),
            strategy="popularity_diversity_v1",
        )

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
            if isinstance(k, (int, float, str)) and str(k).isdigit()
        }
        game_platforms = {
            int(p)
            for p in (game.get("platforms") or [])
            if isinstance(p, (int, float, str)) and str(p).isdigit()
        }

        keyword_overlap = len(preferred_keywords & game_keywords)
        platform_overlap = len(preferred_platforms & game_platforms)

        score = (keyword_overlap * 3) + (platform_overlap * 2)
        popularity = game.get("popularity", 0.0)

        scored_candidates.append((score, popularity, game_id))

    scored_candidates.sort(key=lambda row: (-row[0], -row[1], row[2]))

    top_n = 10
    recommended_items = [game_id for _, _, game_id in scored_candidates[:top_n]]
    if not recommended_items:
        strategy = "popularity_diversity_v1"
        recommended_items = _popularity_diversity_baseline(candidates, top_n=top_n, excluded_ids=interacted_games)
        _record_named_metric(request, "recommend_user_cold_start_total")
    else:
        strategy = "keyword_platform_overlap_v1"

    _record_named_metric(request, f"recommend_user_strategy_{strategy}_total")
    return UserRecommendResponse(
        user_id=user_id,
        recommended_games=recommended_items,
        strategy=strategy,
    )


# GET /recommend/item/{item_id}
async def recommend_similar(item_id: int, request: Request) -> SimilarResponse:
    """
    Recommend similar items based on the given item id.

    Args:
        item_id (int): the item id to recommend similar items for
        request (Request): FastAPI request object

    Returns:
        SimilarResponse: response containing the item id, top k, similar items, and filters

    Raises:
        HTTPException: if the item id is invalid
    """
    if item_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid item id")

    _record_named_metric(request, "recommend_item_requests_total")
    seed_game, candidate_pool = _fetch_item_similarity_pool(request, item_id=item_id, top_k=3)
    similar = _rank_similar_items(seed_game, candidate_pool, top_k=3)
    _record_named_metric(request, "recommend_item_strategy_relation_text_v1_total")
    if not similar:
        _record_named_metric(request, "recommend_item_pool_empty_total")

    return SimilarResponse(item_id=item_id, similar_items=similar)


# POST /recommend/item
async def recommend_similar_post(payload: SimilarRequest, request: Request):
    """
    Recommend similar items based on the given item id.

    Args:
        payload (SimilarRequest): request payload containing the item id and top k
        request (Request): FastAPI request object

    Returns:
        SimilarResponse: response containing the item id, top k, similar items, and filters

    Raises:
        HTTPException: if the item id is invalid
    """
    item_id = payload.item_id
    if item_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid item id")

    k = max(1, min(50, payload.top_k))
    _record_named_metric(request, "recommend_item_requests_total")

    seed_game, candidate_pool = _fetch_item_similarity_pool(request, item_id=item_id, top_k=k)
    similar = _rank_similar_items(seed_game, candidate_pool, top_k=k)
    _record_named_metric(request, "recommend_item_strategy_relation_text_v1_total")
    if not similar:
        _record_named_metric(request, "recommend_item_pool_empty_total")

    return SimilarResponse(
        item_id=item_id,
        top_k=k,
        similar_items=similar,
        filters=payload.filters or {},
    )

