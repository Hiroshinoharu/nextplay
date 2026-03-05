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

def load_candidate_index_map(candidate_index_map_path: str) -> dict[int, int]:
    """Load candidate index -> game ID mapping used to translate model output indices."""
    resolved_path = Path(candidate_index_map_path).expanduser().resolve()
    if not resolved_path.exists():
        raise FileNotFoundError(f"candidate_index_map_path does not exist: {resolved_path}")

    with resolved_path.open("r", encoding="utf-8") as map_file:
        payload = json.load(map_file)

    if not isinstance(payload, dict):
        raise RuntimeError("candidate_index_map must be a JSON object of index -> game_id")

    mapped: dict[int, int] = {}
    for key, value in payload.items():
        try:
            candidate_index = int(key)
            game_id = int(value)
        except (TypeError, ValueError) as exc:
            raise RuntimeError("candidate_index_map contains non-integer key/value") from exc

        mapped[candidate_index] = game_id

    return mapped