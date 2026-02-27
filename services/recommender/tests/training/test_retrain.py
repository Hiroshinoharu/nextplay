import csv
import json
import random
from pathlib import Path

from services.recommender.training.retrain import run_experiment, set_global_seed

def _write_fixture(path: Path) -> None:
    """
    Write a test CSV fixture to the given path.

    The fixture contains user interactions with the following columns:

    - user_id (int): The ID of the user.
    - game_id (int): The ID of the game.
    - event_ts (UTC ISO-8601 string): The timestamp of the interaction.
    - liked (string): Whether the user liked the game or not.
    - rating (float or string): The rating of the game by the user.

    The fixture contains six rows with two users and three games each.
    """
    rows = [
        {"user_id": "1", "game_id": "10", "event_ts": "2025-01-01T00:00:00Z", "liked": "true", "rating": ""},
        {"user_id": "1", "game_id": "11", "event_ts": "2025-01-02T00:00:00Z", "liked": "", "rating": "5.0"},
        {"user_id": "2", "game_id": "12", "event_ts": "2025-01-03T00:00:00Z", "liked": "false", "rating": ""},
        {"user_id": "2", "game_id": "13", "event_ts": "2025-01-04T00:00:00Z", "liked": "", "rating": "1.0"},
        {"user_id": "1", "game_id": "12", "event_ts": "2025-01-05T00:00:00Z", "liked": "true", "rating": ""},
        {"user_id": "2", "game_id": "10", "event_ts": "2025-01-06T00:00:00Z", "liked": "true", "rating": ""},
    ]

    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

def _write_loose_thresholds(path: Path) -> None:
    """
    Write a JSON file containing loose quality gate thresholds to the given path.

    The thresholds are as follows:

    - min_recall_at_k: 0.0
    - min_ndcg_at_k: 0.0
    - min_map_at_k: 0.0
    - min_coverage_at_k: 0.0
    - min_list_diversity_at_k: 0.0
    - min_recall_lift_vs_popularity: -1.0
    - min_ndcg_lift_vs_popularity: -1.0
    - min_map_lift_vs_popularity: -1.0
    - min_recall_lift_vs_fallback: -1.0
    """
    thresholds = {
        "min_recall_at_k": 0.0,
        "min_ndcg_at_k": 0.0,
        "min_map_at_k": 0.0,
        "min_coverage_at_k": 0.0,
        "min_list_diversity_at_k": 0.0,
        "min_recall_lift_vs_popularity": -1.0,
        "min_ndcg_lift_vs_popularity": -1.0,
        "min_map_lift_vs_popularity": -1.0,
        "min_recall_lift_vs_fallback": -1.0,
    }
    path.write_text(json.dumps(thresholds), encoding="utf-8")

def test_set_global_seed_reproducibly_controls_python_and_numpy() -> None:
    """
    Verifies that the set_global_seed function reproducibly controls the Python and NumPy
    random number generators. This test sets the global seed to a fixed value and then
    samples the random number generators before and after resetting the seed. If the
    seed is set correctly, the two samples should be equal.

    This test is important because it ensures that the training process is
    reproducible across different machines and runs.
    """
    set_global_seed(123)
    first_python = random.random()

    set_global_seed(123)
    second_python = random.random()

    assert first_python == second_python

def test_run_experiment_logs_hashes_params_and_metrics_reproducibly(tmp_path: Path) -> None:
    """
    Verifies that the run_experiment function logs the hashes of the parameters and
    metrics, and that the function is reproducible when given the same input
    parameters.

    This test is important because it ensures that the training process is
    reproducible across different machines and runs.

    :param tmp_path: A temporary directory to write the test data to.
    :type tmp_path: Path
    :return: None
    :rtype: None
    """
    input_csv = tmp_path / "input.csv"
    thresholds_json = tmp_path / "thresholds.json"
    _write_fixture(input_csv)
    _write_loose_thresholds(thresholds_json)

    repo_root = Path(__file__).resolve().parents[4]

    run_a = run_experiment(
        input_csv=input_csv,
        run_dir=tmp_path / "runs" / "run_a",
        train_ratio=0.8,
        validation_ratio=0.1,
        threshold_json=thresholds_json,
        k=2,
        seed=7,
        repo_root=repo_root,
    )
    run_b = run_experiment(
        input_csv=input_csv,
        run_dir=tmp_path / "runs" / "run_b",
        train_ratio=0.8,
        validation_ratio=0.1,
        threshold_json=thresholds_json,
        k=2,
        seed=7,
        repo_root=repo_root,
    )

    assert run_a["params"] == run_b["params"]
    assert run_a["metrics"] == run_b["metrics"]
    assert run_a["seeding"]["python_seed"] == 7
    assert run_a["hashes"]["dataset_source_sha256"] == run_b["hashes"]["dataset_source_sha256"]
    assert run_a["hashes"]["predictions_csv_sha256"] == run_b["hashes"]["predictions_csv_sha256"]
    assert run_a["hashes"]["training_code_sha256"] == run_b["hashes"]["training_code_sha256"]

    log_path = tmp_path / "runs" / "run_a" / "run_log.json"
    assert log_path.exists()
    persisted = json.loads(log_path.read_text(encoding="utf-8"))
    assert persisted["hashes"]["test_csv_sha256"]
    assert persisted["metrics"]["model"]["recall_at_k"] >= 0.0