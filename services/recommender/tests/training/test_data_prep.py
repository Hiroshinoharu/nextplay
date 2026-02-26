import csv
import json
from pathlib import Path

from services.recommender.training.data_prep import infer_label, run_split

def _write_fixture(path: Path) -> None:
    """Helper function to write a test CSV fixture for data preparation tests."""
    rows = [
        {"user_id": "1", "game_id": "10", "event_ts": "2025-01-01T00:00:00Z", "liked": "true", "rating": ""},
        {"user_id": "1", "game_id": "11", "event_ts": "2025-01-02T00:00:00Z", "liked": "", "rating": "5.0"},
        {"user_id": "2", "game_id": "12", "event_ts": "2025-01-03T00:00:00Z", "liked": "false", "rating": ""},
        {"user_id": "2", "game_id": "13", "event_ts": "2025-01-04T00:00:00Z", "liked": "", "rating": "1.0"},
        {"user_id": "3", "game_id": "14", "event_ts": "2025-01-05T00:00:00Z", "liked": "", "rating": "3.0"},
        {"user_id": "3", "game_id": "15", "event_ts": "2025-01-06T00:00:00Z", "liked": "", "rating": "4.0"},
    ]
    
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

def test_infer_label_from_liked_or_rating_rules() -> None:
    """Test that the infer_label function correctly infers labels based on 'liked' and 'rating' fields according to the defined rules."""
    assert infer_label({"liked": "true", "rating": ""}) == 1
    assert infer_label({"liked": "false", "rating": ""}) == 0
    assert infer_label({"liked": "", "rating": "4.0"}) == 1
    assert infer_label({"liked": "", "rating": "1.0"}) == 0
    assert infer_label({"liked": "", "rating": "3.0"}) is None

def test_run_split_creates_time_ordered_splits_and_manifest(tmp_path: Path) -> None:
    """Test that the run_split function creates time-ordered train/val/test splits and generates a manifest file with correct metadata."""
    input_csv = tmp_path / "input.csv"
    out_dir = tmp_path / "prepared"
    _write_fixture(input_csv)
    
    manifest = run_split(input_csv, out_dir)
    
    assert manifest["split_strategy"] == "time_based"
    assert manifest["row_counts"]["train"] == 4
    
    train_rows = list(csv.DictReader((out_dir / "train.csv").open("r", encoding="utf-8")))
    validation_rows = list(csv.DictReader((out_dir / "validation.csv").open("r", encoding="utf-8")))
    test_rows = list(csv.DictReader((out_dir / "test.csv").open("r", encoding="utf-8")))
    
    assert [row["game_id"] for row in train_rows] == ["10", "11", "12", "13"]
    assert validation_rows == []
    assert [row["game_id"] for row in test_rows] == ["15"]
    
    manifest_file = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest_file["source_path"] == str(input_csv)
    assert manifest_file["source_sha256"]
