from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from typing import Any


def _read_float_env(name: str, default: float, *, minimum: float = -100.0, maximum: float = 100.0) -> float:
    """
    Reads an environment variable as a float, clamping the result to
    the given minimum and maximum values.

    Args:
        name (str): The name of the environment variable to read.
        default (float): The default value to return if the variable is not set.
        minimum (float, optional): The minimum value to clamp the result to. Defaults to -100.0.
        maximum (float, optional): The maximum value to clamp the result to. Defaults to 100.0.

    Returns:
        float: The clamped float value from the environment variable.
    """
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        parsed = float(raw)
    except ValueError:
        return default
    return min(max(parsed, minimum), maximum)


def _read_int_env(name: str, default: int, *, minimum: int = 0, maximum: int = 100) -> int:
    """
    Reads an environment variable as an integer, clamping the result to
    the given minimum and maximum values.

    Args:
        name (str): The name of the environment variable to read.
        default (int): The default value to return if the variable is not set.
        minimum (int, optional): The minimum value to clamp the result to. Defaults to 0.
        maximum (int, optional): The maximum value to clamp the result to. Defaults to 100.

    Returns:
        int: The clamped integer value from the environment variable.
    """
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        parsed = int(raw)
    except ValueError:
        return default
    return min(max(parsed, minimum), maximum)


@dataclass(frozen=True)
class RankingProfile:
    name: str
    liked_keyword: float
    liked_platform: float
    answer_token: float
    favorite_keyword: float
    favorite_platform: float
    favorite_genre: float
    favorite_text_sim: float
    disliked_keyword: float
    disliked_platform: float
    model_seed_boost: float
    favorite_seed_boost: float
    cap_popularity: float
    cap_rating: float
    release_era_match: float
    exploration_jitter: float
    recent_exposure_penalty: float
    similarity_strict: float
    similarity_relaxed: float
    top_band_genre_cap: int
    global_genre_cap: int

    def to_dict(self) -> dict[str, Any]:
        """
        Converts the ranking profile to a dictionary.

        Returns:
            dict[str, Any]: A dictionary containing the ranking profile attributes.
        """
        return asdict(self)


BASE_PROFILES: dict[str, RankingProfile] = {
    "balanced_v1": RankingProfile(
        name="balanced_v1",
        liked_keyword=4.0,
        liked_platform=2.5,
        answer_token=1.35,
        favorite_keyword=2.5,
        favorite_platform=1.4,
        favorite_genre=1.8,
        favorite_text_sim=5.4,
        disliked_keyword=6.0,
        disliked_platform=4.5,
        model_seed_boost=2.6,
        favorite_seed_boost=4.6,
        cap_popularity=0.85,
        cap_rating=0.9,
        release_era_match=1.4,
        exploration_jitter=0.18,
        recent_exposure_penalty=2.8,
        similarity_strict=0.64,
        similarity_relaxed=0.82,
        top_band_genre_cap=2,
        global_genre_cap=4,
    ),
}


def _with_env_overrides(profile: RankingProfile) -> RankingProfile:
    """
    Returns a new RankingProfile instance with the same attributes as the input profile,
    but with overridden values from environment variables.

    Environment variables are read using the following format:
    RANK_WEIGHT_<ATTRIBUTE_NAME>

    For example, to override the liked_keyword attribute, set the environment variable
    RANK_WEIGHT_LIKED_KEYWORD to the desired value.

    Attributes that are not overridden by environment variables retain their original values.

    :param profile: The RankingProfile instance to create a new instance from.
    :return: A new RankingProfile instance with overridden attribute values from environment variables.
    """
    return RankingProfile(
        name=profile.name,
        liked_keyword=_read_float_env("RANK_WEIGHT_LIKED_KEYWORD", profile.liked_keyword),
        liked_platform=_read_float_env("RANK_WEIGHT_LIKED_PLATFORM", profile.liked_platform),
        answer_token=_read_float_env("RANK_WEIGHT_ANSWER_TOKEN", profile.answer_token),
        favorite_keyword=_read_float_env("RANK_WEIGHT_FAVORITE_KEYWORD", profile.favorite_keyword),
        favorite_platform=_read_float_env("RANK_WEIGHT_FAVORITE_PLATFORM", profile.favorite_platform),
        favorite_genre=_read_float_env("RANK_WEIGHT_FAVORITE_GENRE", profile.favorite_genre),
        favorite_text_sim=_read_float_env("RANK_WEIGHT_FAVORITE_TEXT_SIM", profile.favorite_text_sim),
        disliked_keyword=_read_float_env("RANK_WEIGHT_DISLIKED_KEYWORD", profile.disliked_keyword),
        disliked_platform=_read_float_env("RANK_WEIGHT_DISLIKED_PLATFORM", profile.disliked_platform),
        model_seed_boost=_read_float_env("RANK_WEIGHT_MODEL_SEED_BOOST", profile.model_seed_boost),
        favorite_seed_boost=_read_float_env("RANK_WEIGHT_FAVORITE_SEED_BOOST", profile.favorite_seed_boost),
        cap_popularity=_read_float_env("RANK_CAP_POPULARITY", profile.cap_popularity, minimum=0.0, maximum=10.0),
        cap_rating=_read_float_env("RANK_CAP_RATING", profile.cap_rating, minimum=0.0, maximum=10.0),
        release_era_match=_read_float_env("RANK_WEIGHT_RELEASE_ERA_MATCH", profile.release_era_match),
        exploration_jitter=_read_float_env(
            "RANK_WEIGHT_EXPLORATION_JITTER",
            profile.exploration_jitter,
            minimum=0.0,
            maximum=5.0,
        ),
        recent_exposure_penalty=_read_float_env(
            "RANK_PENALTY_RECENT_EXPOSURE",
            profile.recent_exposure_penalty,
            minimum=0.0,
            maximum=20.0,
        ),
        similarity_strict=_read_float_env(
            "RANK_SIMILARITY_STRICT",
            profile.similarity_strict,
            minimum=0.0,
            maximum=1.0,
        ),
        similarity_relaxed=_read_float_env(
            "RANK_SIMILARITY_RELAXED",
            profile.similarity_relaxed,
            minimum=0.0,
            maximum=1.0,
        ),
        top_band_genre_cap=_read_int_env("RANK_TOP_BAND_GENRE_CAP", profile.top_band_genre_cap, minimum=1, maximum=10),
        global_genre_cap=_read_int_env("RANK_GLOBAL_GENRE_CAP", profile.global_genre_cap, minimum=1, maximum=10),
    )


def load_active_ranking_profile() -> RankingProfile:
    """
    Load the active ranking profile by name from environment variable
    RANKING_PROFILE (defaulting to "balanced_v1" if not set).
    The active profile is a combination of the base profile and any
    environment variable overrides.
    """
    name = (os.getenv("RANKING_PROFILE", "balanced_v1").strip() or "balanced_v1").lower()
    base = BASE_PROFILES.get(name, BASE_PROFILES["balanced_v1"])
    return _with_env_overrides(base)


ACTIVE_RANKING_PROFILE = load_active_ranking_profile()
