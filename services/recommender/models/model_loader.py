from importlib import import_module
import json
from pathlib import Path
from typing import Any


def load_model(model_path: str) -> Any:
    """Load a Keras model from disk for use during request handling."""
    resolved_path = Path(model_path).expanduser().resolve()
    if not resolved_path.exists():
        raise FileNotFoundError(f"MODEL_PATH does not exist: {resolved_path}")

    keras_models = import_module("keras.models")
    return keras_models.load_model(str(resolved_path))


def _load_int_key_map(path_value: str, *, missing_label: str) -> dict[int, float]:
    resolved_path = Path(path_value).expanduser().resolve()
    if not resolved_path.exists():
        raise FileNotFoundError(f"{missing_label} does not exist: {resolved_path}")

    with resolved_path.open("r", encoding="utf-8") as map_file:
        payload = json.load(map_file)

    if not isinstance(payload, dict):
        raise RuntimeError("artifact map must be a JSON object of index -> value")

    mapped: dict[int, float] = {}
    for key, value in payload.items():
        try:
            candidate_index = int(key)
            mapped_value = float(value)
        except (TypeError, ValueError) as exc:
            raise RuntimeError("artifact map contains non-numeric key/value") from exc
        mapped[candidate_index] = mapped_value

    return mapped


def load_candidate_index_map(candidate_index_map_path: str) -> dict[int, int]:
    """Load candidate index -> game ID mapping used to translate model output indices."""
    payload = _load_int_key_map(
        candidate_index_map_path,
        missing_label="candidate_index_map_path",
    )
    return {candidate_index: int(game_id) for candidate_index, game_id in payload.items()}


def load_popularity_prior_map(popularity_prior_path: str) -> dict[int, float]:
    """Load candidate index -> normalized popularity prior used by hybrid ranking."""
    return _load_int_key_map(
        popularity_prior_path,
        missing_label="popularity_prior_path",
    )
