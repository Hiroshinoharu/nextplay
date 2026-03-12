import csv
import json
import random
from pathlib import Path

from services.recommender.training.retrain import run_experiment, set_global_seed


def _write_fixture(path: Path) -> None:
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
    set_global_seed(123)
    first_python_seed = random.getrandbits(32)
    first_python = random.Random(first_python_seed).random()

    set_global_seed(123)
    second_python_seed = random.getrandbits(32)
    second_python = random.Random(second_python_seed).random()

    assert first_python_seed == second_python_seed
    assert first_python == second_python


def test_run_experiment_logs_hashes_and_gate_artifacts_reproducibly(tmp_path: Path) -> None:
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
    assert persisted["hashes"]["test_csv_sha256"]
    assert persisted["metrics"]["model"]["recall_at_k"] >= 0.0
    assert persisted["artifacts"]["artifact_version"] == "run_a"
    assert persisted["gate_result"]["code"] == "ok"
    assert persisted["dataset_profile"]["path"].endswith("dataset_profile.json")


def test_run_experiment_blocks_promotion_when_offline_gates_fail(tmp_path: Path) -> None:
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
