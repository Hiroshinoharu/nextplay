from pathlib import Path

import pytest

from services.recommender.main import _build_model_config, _validate_model_config


def test_build_model_config_uses_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
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
    cfg = {"path": "", "version": "dev", "required": False}

    assert _validate_model_config(cfg) is None


def test_validate_model_config_raises_if_required_without_path() -> None:
    cfg = {"path": "", "version": "dev", "required": True}

    with pytest.raises(RuntimeError, match="MODEL_REQUIRED=true but MODEL_PATH is not set"):
        _validate_model_config(cfg)


def test_validate_model_config_raises_for_missing_file(tmp_path: Path) -> None:
    cfg = {"path": str(tmp_path / "missing.keras"), "version": "v1", "required": False}

    with pytest.raises(RuntimeError, match="MODEL_PATH does not exist"):
        _validate_model_config(cfg)


def test_validate_model_config_returns_resolved_path_for_existing_file(tmp_path: Path) -> None:
    model_file = tmp_path / "model.keras"
    model_file.write_text("test")
    cfg = {"path": str(model_file), "version": "v2", "required": True}

    resolved = _validate_model_config(cfg)

    assert resolved == model_file.resolve()