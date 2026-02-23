from importlib import import_module
from pathlib import Path
from typing import Any


def load_model(model_path: str) -> Any:
    """Load a Keras model from disk for use during request handling."""
    resolved_path = Path(model_path).expanduser().resolve()
    if not resolved_path.exists():
        raise FileNotFoundError(f"MODEL_PATH does not exist: {resolved_path}")

    keras_models = import_module("keras.models")
    return keras_models.load_model(str(resolved_path))