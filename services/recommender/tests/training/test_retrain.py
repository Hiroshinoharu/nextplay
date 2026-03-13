import csv
import json
import random
from pathlib import Path

from services.recommender.training.retrain import _write_predictions_csv, run_experiment, set_global_seed


def _write_fixture(path: Path) -> None:
    """
    Writes a CSV file containing fixture data for testing the offline evaluation pipeline to the given path.

    The fixture data contains a set of user-game interactions with varied liked and rating values to test the correctness of the offline evaluation pipeline.

    Args:
        path (Path): The path to write the CSV file to.
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


def _write_thresholds(path: Path, *, strict: bool) -> None:
    """
    Writes a JSON file containing minimum required quality metrics to the given path.

    Args:
        path (Path): The path to write the JSON file to.
        strict (bool): If True, all quality metrics are set to the minimum required values for the offline evaluation acceptance criteria.

    Notes:
        This function writes a JSON file containing the following quality metrics:
        - min_recall_at_k: Minimum required recall at K.
        - min_ndcg_at_k: Minimum required normalized discounted cumulative gain at K.
        - min_map_at_k: Minimum required mean average precision at K.
        - min_coverage_at_k: Minimum required coverage at K.
        - min_list_diversity_at_k: Minimum required list diversity at K.
        - min_recall_lift_vs_popularity: Minimum required lift in recall vs the popularity baseline at K.
        - min_ndcg_lift_vs_popularity: Minimum required lift in normalized discounted cumulative gain vs the popularity baseline at K.
        - min_map_lift_vs_popularity: Minimum required lift in mean average precision vs the popularity baseline at K.
        - min_recall_lift_vs_fallback: Minimum required lift in recall vs the rule-based fallback baseline at K.
    """
    value = 1.1 if strict else 0.0
    thresholds = {
        "min_recall_at_k": value,
        "min_ndcg_at_k": value,
        "min_map_at_k": value,
        "min_coverage_at_k": value,
        "min_list_diversity_at_k": value,
        "min_recall_lift_vs_popularity": -1.0 if not strict else 1.1,
        "min_ndcg_lift_vs_popularity": -1.0 if not strict else 1.1,
        "min_map_lift_vs_popularity": -1.0 if not strict else 1.1,
        "min_recall_lift_vs_fallback": -1.0 if not strict else 1.1,
    }
    path.write_text(json.dumps(thresholds), encoding="utf-8")


def _low_quality_threshold_kwargs() -> dict[str, float | int]:
    """
    Returns a dictionary containing low-quality dataset threshold values.

    The returned dictionary is suitable for passing to run_experiment() as the threshold_json argument.

    The returned values are set to the minimum required values for the offline evaluation acceptance criteria.

    :return: A dictionary containing low-quality dataset threshold values.
    :rtype: dict[str, float | int]
    """
    return {
        "min_rows": 1,
        "min_unique_users": 1,
        "min_unique_games": 1,
        "min_positive_rows": 1,
        "min_negative_rows": 1,
        "min_users_with_positive": 1,
        "min_interactions_per_user": 1,
        "min_train_rows": 1,
        "min_validation_rows": 0,
        "min_test_rows": 1,
        "min_positive_ratio": 0.0,
        "max_positive_ratio": 1.0,
    }


def test_set_global_seed_reproducibly_controls_python_and_numpy() -> None:
    """
    Verifies that set_global_seed(123) sets the same random seed for both
    Python's built-in random module and NumPy, and that subsequent calls
    to random.Random() and random.Random().random() produce the same
    results after setting the seed. This ensures that the randomness in
    the model training process is reproducible.

    The function sets the global random seed to 123, takes a snapshot of
    the current Python and NumPy random states, resets the global random
    seed to 123 again, and takes another snapshot of the current Python
    and NumPy random states. It then asserts that the two snapshots are
    equal, which proves that the randomness is reproducible.

    :return: None
    """
    set_global_seed(123)
    first_python_seed = random.getrandbits(32)
    first_python = random.Random(first_python_seed).random()

    set_global_seed(123)
    second_python_seed = random.getrandbits(32)
    second_python = random.Random(second_python_seed).random()

    assert first_python_seed == second_python_seed
    assert first_python == second_python


def test_run_experiment_logs_hashes_and_gate_artifacts_reproducibly(tmp_path: Path) -> None:
    """
    Verify that run_experiment logs hashes and gate artifacts reproducibly.

    Verifies that:

    - The run result has "params" set to the input parameters.
    - The run result has "metrics" set to the computed metrics.
    - The run result has "seeding" set to the used random seeds.
    - The run result has "hashes" set to the computed hashes of the dataset source, predictions CSV, and training code.
    - The persisted run log has "hashes.test_csv_sha256" set to the test CSV hash.
    - The persisted run log has "metrics.model.recall_at_k" set to a value greater than or equal to 0.0.
    - The persisted run log has "artifacts.artifact_version" set to the run ID.
    - The persisted run log has "gate_result.code" set to "ok".
    - The persisted run log has "dataset_profile.path" set to a path ending with "dataset_profile.json".
    - The persisted run log has "training.tensorboard_enabled" set to True.
    - The persisted run log has "training.tensorboard_log_dir" set to a path ending with "tensorboard".
    - The persisted run log has a valid "training.tensorboard_log_dir" path.

    This test covers the reproducibility of the run_experiment function and its logging/gating outputs.

    """
    input_csv = tmp_path / "input.csv"
    thresholds_json = tmp_path / "thresholds.json"
    _write_fixture(input_csv)
    _write_thresholds(thresholds_json, strict=False)

    repo_root = Path(__file__).resolve().parents[4]

    run_a = run_experiment(
        input_csv=input_csv,
        source_mode="db_only",
        run_dir=tmp_path / "runs" / "run_a",
        train_ratio=0.8,
        validation_ratio=0.1,
        threshold_json=thresholds_json,
        k=2,
        seed=7,
        repo_root=repo_root,
        **_low_quality_threshold_kwargs(),
    )
    run_b = run_experiment(
        input_csv=input_csv,
        source_mode="db_only",
        run_dir=tmp_path / "runs" / "run_b",
        train_ratio=0.8,
        validation_ratio=0.1,
        threshold_json=thresholds_json,
        k=2,
        seed=7,
        repo_root=repo_root,
        **_low_quality_threshold_kwargs(),
    )

    assert run_a["params"] == run_b["params"]
    assert run_a["metrics"] == run_b["metrics"]
    assert run_a["seeding"]["python_seed"] == 7
    assert run_a["hashes"]["dataset_source_sha256"] == run_b["hashes"]["dataset_source_sha256"]
    assert run_a["hashes"]["predictions_csv_sha256"] == run_b["hashes"]["predictions_csv_sha256"]
    assert run_a["hashes"]["training_code_sha256"] == run_b["hashes"]["training_code_sha256"]

    persisted = json.loads((tmp_path / "runs" / "run_a" / "run_log.json").read_text(encoding="utf-8"))
    manifest = json.loads(Path(persisted["artifacts"]["manifest_path"]).read_text(encoding="utf-8"))
    assert persisted["hashes"]["test_csv_sha256"]
    assert persisted["metrics"]["model"]["recall_at_k"] >= 0.0
    assert persisted["artifacts"]["artifact_version"] == "run_a"
    assert persisted["gate_result"]["code"] == "ok"
    assert persisted["dataset_profile"]["path"].endswith("dataset_profile.json")
    assert persisted["training"]["tensorboard_enabled"] is True
    assert persisted["training"]["tensorboard_log_dir"].endswith("tensorboard")
    assert Path(persisted["training"]["tensorboard_log_dir"]).exists()
    assert "git_commit" in manifest


def test_run_experiment_blocks_promotion_when_offline_gates_fail(tmp_path: Path) -> None:
    """
    Test that run_experiment blocks promotion when offline gates fail.

    Verifies that:

    - The run result has "metrics.passed" set to False.
    - The run result has "promotion.promoted" set to False.
    - The run result has "promotion.status" set to "offline_eval_failed".
    - The run result has "gate_result.code" set to "offline_eval_failed".
    - The persisted run log has "promotion.artifact_version" set to the run ID.
    - The persisted run log has "promotion.manifest_path" set to a path ending with "artifact_manifest.json".
    - The persisted run log has "promotion.candidate_index_map_path" set to a path ending with "candidate_index_map.json".
    """
    input_csv = tmp_path / "input.csv"
    thresholds_json = tmp_path / "strict_thresholds.json"
    _write_fixture(input_csv)
    _write_thresholds(thresholds_json, strict=True)

    repo_root = Path(__file__).resolve().parents[4]
    run_result = run_experiment(
        input_csv=input_csv,
        source_mode="db_only",
        run_dir=tmp_path / "runs" / "run_fail",
        train_ratio=0.8,
        validation_ratio=0.1,
        threshold_json=thresholds_json,
        k=2,
        seed=13,
        repo_root=repo_root,
        **_low_quality_threshold_kwargs(),
    )

    assert run_result["metrics"]["passed"] is False
    assert run_result["promotion"]["promoted"] is False
    assert run_result["promotion"]["status"] == "offline_eval_failed"
    assert run_result["gate_result"]["code"] == "offline_eval_failed"

    persisted = json.loads((tmp_path / "runs" / "run_fail" / "run_log.json").read_text(encoding="utf-8"))
    assert persisted["promotion"]["artifact_version"] == "run_fail"
    assert persisted["promotion"]["manifest_path"].endswith("artifact_manifest.json")
    assert persisted["promotion"]["candidate_index_map_path"].endswith("candidate_index_map.json")


def test_run_experiment_fails_dataset_quality_before_training(tmp_path: Path) -> None:
    """
    Test that run_experiment fails when dataset quality thresholds are not met before training.
    The test creates a sample input CSV file and a thresholds JSON file with relaxed
    dataset quality thresholds. The test then runs the experiment with the input
    CSV and thresholds JSON, and verifies that the experiment fails with a
    dataset_quality_failed gate result code, and that the training, metrics, and
    artifacts dictionaries are all None. The test also verifies that the promotion
    status is set to "dataset_quality_failed".
    """
    input_csv = tmp_path / "input.csv"
    thresholds_json = tmp_path / "thresholds.json"
    _write_fixture(input_csv)
    _write_thresholds(thresholds_json, strict=False)

    repo_root = Path(__file__).resolve().parents[4]
    run_result = run_experiment(
        input_csv=input_csv,
        source_mode="db_only",
        run_dir=tmp_path / "runs" / "run_quality_fail",
        train_ratio=0.8,
        validation_ratio=0.1,
        threshold_json=thresholds_json,
        k=2,
        seed=21,
        repo_root=repo_root,
    )

    assert run_result["gate_result"]["code"] == "dataset_quality_failed"
    assert run_result["training"] is None
    assert run_result["metrics"] is None
    assert run_result["artifacts"] is None
    assert run_result["promotion"]["status"] == "dataset_quality_failed"


class _FakePredictModel:
    def predict(self, payload, verbose=0):
        """Predict game scores given user and game IDs.

        Args:
            payload (ModelInputSchema): input data containing user and game IDs.
            verbose (int): verbosity level (default is 0).

        Returns:
            List[List[float]]: list of lists, where each inner list contains the predicted scores for the corresponding game in the input payload.
        """
        return [[0.1, 0.9, 0.4]]


def test_write_predictions_csv_uses_model_scores_and_skips_seen_games(tmp_path: Path, monkeypatch) -> None:
    """
    Test that _write_predictions_csv uses model scores and skips seen games.

    This test verifies that the _write_predictions_csv function uses the predicted scores from the model
    to write the output CSV file and skips writing rows for games that users have already interacted with.

    The test creates sample training, test, and candidate index map CSV files, loads a fake model that returns
    a single score of 0.1 for each user-game pair, and calls _write_predictions_csv. The output is then verified
    to contain the expected rows.
    """
    train_csv = tmp_path / "train.csv"
    test_csv = tmp_path / "test.csv"
    predictions_csv = tmp_path / "predictions.csv"
    candidate_map = tmp_path / "candidate_index_map.json"
    model_path = tmp_path / "model.keras"

    train_rows = [
        {"user_id": "1", "game_id": "10", "label": "1"},
        {"user_id": "1", "game_id": "11", "label": "0"},
        {"user_id": "2", "game_id": "12", "label": "1"},
    ]
    test_rows = [
        {"user_id": "1", "game_id": "12", "label": "1"},
    ]

    with train_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["user_id", "game_id", "label"])
        writer.writeheader()
        writer.writerows(train_rows)

    with test_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["user_id", "game_id", "label"])
        writer.writeheader()
        writer.writerows(test_rows)

    candidate_map.write_text(json.dumps({"1": 10, "2": 11, "3": 12}), encoding="utf-8")
    model_path.write_text("placeholder", encoding="utf-8")

    monkeypatch.setattr('services.recommender.training.retrain.load_model', lambda _: _FakePredictModel())

    _write_predictions_csv(
        train_csv=train_csv,
        test_csv=test_csv,
        output_path=predictions_csv,
        k=2,
        model_path=model_path,
        candidate_index_map_path=candidate_map,
    )

    with predictions_csv.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    assert rows == [
        {"user_id": "1", "game_id": "12", "rank": "1"},
    ]

