from pathlib import Path

import pytest

from services.recommender.main import _build_model_config, _validate_model_config


def test_build_model_config_uses_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    This will test the build of the model and it'll use the default configurations set
    Args:
        monkeypatch (pytest.MonkeyPatch): _description_
    """
    monkeypatch.delenv("MODEL_PATH", raising=False)
    monkeypatch.delenv("MODEL_VERSION", raising=False)
    monkeypatch.delenv("MODEL_REQUIRED", raising=False)

    cfg = _build_model_config()

    assert cfg == {
        "path": "",
        "version": "dev",
        "required": False,
    }


def test_validate_model_config_returns_none_if_not_required() -> None:
    """
    This will validate if the configuration is None
    """
    cfg = {"path": "", "version": "dev", "required": False}

    assert _validate_model_config(cfg) is None


def test_validate_model_config_raises_if_required_without_path() -> None:
    """
    This will test for a error making sure that all parameters are passed
    """
    cfg = {"path": "", "version": "dev", "required": True}

    with pytest.raises(RuntimeError, match="MODEL_REQUIRED=true but MODEL_PATH is not set"):
        _validate_model_config(cfg)


def test_validate_model_config_raises_for_missing_file(tmp_path: Path) -> None:
    """
    This will test if we get an error indicating that the keras path doesn't exist when the file is missing but required
    Args:
        tmp_path (Path): Pytest fixture that provides a temporary directory unique to the test invocation, which is automatically cleaned up after the test.
    """
    cfg = {"path": str(tmp_path / "missing.keras"), "version": "v1", "required": False}

    with pytest.raises(RuntimeError, match="MODEL_PATH does not exist"):
        _validate_model_config(cfg)


def test_validate_model_config_returns_resolved_path_for_existing_file(tmp_path: Path) -> None:
    """
    This will test if we get the resolved path for the keras model when the file exists and is required
    Args:
        tmp_path (Path): Pytest fixture that provides a temporary directory unique to the test invocation, which is automatically cleaned up after the test.
    """
    model_file = tmp_path / "model.keras"
    model_file.write_text("test")
    cfg = {"path": str(model_file), "version": "v2", "required": True}

    resolved = _validate_model_config(cfg)

    assert resolved == model_file.resolve()