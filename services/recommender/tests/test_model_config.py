from pathlib import Path

import pytest

from services.recommender.main import _build_model_config, _validate_model_config, _resolve_manifest_path


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
        "manifest_path": "",
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

def test_resolve_manifest_path_uses_explicit_value(tmp_path: Path) -> None:
    """
    Test that _resolve_manifest_path uses an explicitly provided manifest path.
    This test verifies that when a manifest_path is explicitly configured in the config dictionary,
    the function returns the resolved absolute path in POSIX format, regardless of any other parameters.
    Args:
        tmp_path: A temporary directory path fixture provided by pytest.
    Asserts:
        That the resolved manifest path matches the expected absolute path in POSIX format.
    """
    manifest_file = tmp_path / "model.manifest.json"
    cfg = {"manifest_path": str(manifest_file)}

    resolved = _resolve_manifest_path(cfg, None)

    assert resolved == manifest_file.resolve().as_posix()


def test_resolve_manifest_path_defaults_from_model_path(tmp_path: Path) -> None:
    """
    Test that _resolve_manifest_path defaults to a manifest file path based on the model file path.
    When an empty manifest_path is provided, the function should return a path derived from
    the model file by replacing its suffix with ".manifest.json" and converting it to POSIX format.
    Args:
        tmp_path: Pytest fixture providing a temporary directory path for test isolation.
    """
    model_file = tmp_path / "model.keras"

    resolved = _resolve_manifest_path({"manifest_path": ""}, model_file)

    assert resolved == model_file.with_suffix(".manifest.json").as_posix()