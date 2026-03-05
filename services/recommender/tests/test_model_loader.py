import json
from pathlib import Path

import pytest

from services.recommender.models.model_loader import load_candidate_index_map


def test_load_candidate_index_map_happy_path(tmp_path: Path) -> None:
    """
    Test that load_candidate_index_map correctly loads a candidate index map from a file.
    
    Creates a temporary candidate index map file, loads it using load_candidate_index_map, and
    verifies that the loaded map matches the expected contents.
    """
    map_path = tmp_path / "candidate_map.json"
    map_path.write_text(json.dumps({"1": 501, "2": "502"}), encoding="utf-8")

    loaded = load_candidate_index_map(str(map_path))

    assert loaded == {1: 501, 2: 502}


def test_load_candidate_index_map_raises_for_missing_file(tmp_path: Path) -> None:
    """
    Test that load_candidate_index_map raises FileNotFoundError when the specified candidate index map path does not exist.

    This test verifies that the load_candidate_index_map function properly raises a FileNotFoundError with a
    descriptive error message when the candidate index map file is missing.

    """
    with pytest.raises(FileNotFoundError, match="candidate_index_map_path does not exist"):
        load_candidate_index_map(str(tmp_path / "missing_map.json"))


def test_load_candidate_index_map_raises_for_non_integer_entries(tmp_path: Path) -> None:
    """
    Test that load_candidate_index_map raises RuntimeError when the candidate index map file contains non-integer entries.

    This test verifies that the load_candidate_index_map function properly raises a RuntimeError with a
    descriptive error message when the candidate index map file contains non-integer entries.

    """
    map_path = tmp_path / "candidate_map.json"
    map_path.write_text(json.dumps({"abc": 1}), encoding="utf-8")

    with pytest.raises(RuntimeError, match="non-integer"):
        load_candidate_index_map(str(map_path))