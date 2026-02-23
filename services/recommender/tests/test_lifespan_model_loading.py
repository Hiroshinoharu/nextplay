import asyncio
from pathlib import Path

from fastapi import FastAPI

from services.recommender import main

def test_lifespan_loads_model_and_exposes_state(monkeypatch) -> None:
    """
    This will test the loading of the model during the runtime of the keras model
    and ensure that the app state is correctly set with the model configuration and loaded model.
    """
    monkeypatch.setattr(
        main,
        "_build_model_config",
        lambda: {"path": "/tmp/model.keras", "version": "v42", "required": True},
    )
    monkeypatch.setattr(main, "_validate_model_config", lambda _: Path("/tmp/model.keras"))
    monkeypatch.setattr(main, "load_model", lambda path: {"loaded_from": path})
    
    app = FastAPI()
    
    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_config["version"] == "v42"
            assert app.state.model_version == "v42"
            assert app.state.model_path == "/tmp/model.keras"
            assert app.state.model == {"loaded_from": "/tmp/model.keras"}
    
    asyncio.run(runner())

def test_lifespan_skips_model_loading_when_model_path_missing(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "_build_model_config",
        lambda: {"path": "", "version": "dev", "required": False},
    )
    monkeypatch.setattr(main, "_validate_model_config", lambda _: None)

    load_calls = []

    def _record_load(path: str):
        load_calls.append(path)
        return "unused"

    monkeypatch.setattr(main, "load_model", _record_load)

    app = FastAPI()

    async def runner() -> None:
        async with main.lifespan(app):
            assert app.state.model_path is None
            assert app.state.model is None
            assert app.state.model_version == "dev"

    asyncio.run(runner())

    assert load_calls == []