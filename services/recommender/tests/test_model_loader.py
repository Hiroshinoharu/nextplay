import json
from pathlib import Path

import pytest

from services.recommender.models.model_loader import (
    load_candidate_index_map,
    load_popularity_prior_map,
)


def test_load_candidate_index_map_happy_path(tmp_path: Path) -> None:
    map_path = tmp_path / "candidate_map.json"
    map_path.write_text(json.dumps({"1": 501, "2": "502"}), encoding="utf-8")

    loaded = load_candidate_index_map(str(map_path))

    assert loaded == {1: 501, 2: 502}


def test_load_candidate_index_map_raises_for_missing_file(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="candidate_index_map_path does not exist"):
        load_candidate_index_map(str(tmp_path / "missing_map.json"))


def test_load_candidate_index_map_raises_for_non_integer_entries(tmp_path: Path) -> None:
    map_path = tmp_path / "candidate_map.json"
    map_path.write_text(json.dumps({"abc": 1}), encoding="utf-8")

    with pytest.raises(RuntimeError, match="non-numeric"):
        load_candidate_index_map(str(map_path))


def test_load_popularity_prior_map_happy_path(tmp_path: Path) -> None:
    prior_path = tmp_path / "popularity_prior.json"
    prior_path.write_text(json.dumps({"1": 1.0, "2": 0.4}), encoding="utf-8")

    loaded = load_popularity_prior_map(str(prior_path))

    assert loaded == {1: 1.0, 2: 0.4}


def test_load_popularity_prior_map_raises_for_missing_file(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="popularity_prior_path does not exist"):
        load_popularity_prior_map(str(tmp_path / "missing_prior.json"))
