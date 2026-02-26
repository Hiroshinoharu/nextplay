import csv
import json
from pathlib import Path

import pytest

from services.recommender.training.offline_eval import run_offline_evaluation


def _write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    """
    Write data to a CSV file.
    Args:
        path: The file path where the CSV will be written.
        rows: A list of dictionaries representing the rows to write.
        fieldnames: A list of column names for the CSV file.
    Returns:
        None
    """
    
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def test_offline_eval_passes_when_model_beats_baselines(tmp_path: Path) -> None:
    """
    Test that offline evaluation passes when the model beats baseline thresholds.
    This test verifies that the offline evaluation function correctly evaluates
    a recommendation model against baseline thresholds and passes when the model's
    performance metrics exceed the specified minimum requirements.
    The test creates:
    - Training data with 3 users and their positive game interactions
    - Test data with 3 users and their positive game interactions
    - Model predictions ranking 2 games per user
    - Threshold requirements for recall, NDCG, MAP, and recall lift metrics
    Asserts:
    - The evaluation result indicates success (passed=True)
    - No gate failures are recorded
    - The recall@k metric equals 1.0 (perfect recall at k=2)
    """
    train_csv = tmp_path / "train.csv"
    test_csv = tmp_path / "test.csv"
    predictions_csv = tmp_path / "predictions.csv"
    thresholds_json = tmp_path / "thresholds.json"

    _write_csv(
        train_csv,
        rows=[
            {"user_id": "1", "game_id": "80", "label": "1"},
            {"user_id": "2", "game_id": "81", "label": "1"},
            {"user_id": "3", "game_id": "82", "label": "1"},
        ],
        fieldnames=["user_id", "game_id", "label"],
    )
    _write_csv(
        test_csv,
        rows=[
            {"user_id": "1", "game_id": "101", "label": "1"},
            {"user_id": "2", "game_id": "102", "label": "1"},
            {"user_id": "3", "game_id": "103", "label": "1"},
        ],
        fieldnames=["user_id", "game_id", "label"],
    )
    _write_csv(
        predictions_csv,
        rows=[
            {"user_id": "1", "game_id": "101", "rank": "1"},
            {"user_id": "1", "game_id": "201", "rank": "2"},
            {"user_id": "2", "game_id": "102", "rank": "1"},
            {"user_id": "2", "game_id": "202", "rank": "2"},
            {"user_id": "3", "game_id": "103", "rank": "1"},
            {"user_id": "3", "game_id": "203", "rank": "2"},
        ],
        fieldnames=["user_id", "game_id", "rank"],
    )

    thresholds_json.write_text(
        json.dumps(
            {
                "min_recall_at_k": 0.8,
                "min_ndcg_at_k": 0.8,
                "min_map_at_k": 0.8,
                "min_recall_lift_vs_popularity": 0.5,
                "min_recall_lift_vs_fallback": 0.5,
            }
        ),
        encoding="utf-8",
    )

    result = run_offline_evaluation(
        train_csv=train_csv,
        test_csv=test_csv,
        predictions_csv=predictions_csv,
        thresholds_json=thresholds_json,
        k=2,
    )

    assert result["passed"] is True
    assert result["gate_failures"] == []
    assert result["model"]["recall_at_k"] == pytest.approx(1.0)


def test_offline_eval_fails_on_gate_regression(tmp_path: Path) -> None:
    """
    Test that offline evaluation fails when recall@k falls below the minimum threshold.
    This test verifies that the offline evaluation process correctly identifies
    gate regressions by checking if the minimum recall@k threshold is violated.
    The test creates sample training, test, and prediction CSV files where the
    predictions do not overlap with the test set, resulting in zero recall@k.
    With a minimum recall@k threshold of 0.5, the evaluation should fail and
    report a gate failure related to min_recall_at_k.
    """
    train_csv = tmp_path / "train.csv"
    test_csv = tmp_path / "test.csv"
    predictions_csv = tmp_path / "predictions.csv"
    thresholds_json = tmp_path / "thresholds.json"

    _write_csv(
        train_csv,
        rows=[{"user_id": "1", "game_id": "90", "label": "1"}],
        fieldnames=["user_id", "game_id", "label"],
    )
    _write_csv(
        test_csv,
        rows=[{"user_id": "1", "game_id": "111", "label": "1"}],
        fieldnames=["user_id", "game_id", "label"],
    )
    _write_csv(
        predictions_csv,
        rows=[{"user_id": "1", "game_id": "999", "rank": "1"}],
        fieldnames=["user_id", "game_id", "rank"],
    )

    thresholds_json.write_text(json.dumps({"min_recall_at_k": 0.5}), encoding="utf-8")

    result = run_offline_evaluation(
        train_csv=train_csv,
        test_csv=test_csv,
        predictions_csv=predictions_csv,
        thresholds_json=thresholds_json,
        k=1,
    )

    assert result["passed"] is False
    assert any("min_recall_at_k" in failure for failure in result["gate_failures"])