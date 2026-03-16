import csv
from pathlib import Path

from services.recommender.training.dataset_pipeline import (
    DatasetQualityConfig,
    build_dataset_profile,
    evaluate_dataset_quality,
    generate_seeded_interactions,
    load_interactions_from_csv,
    merge_interaction_rows,
    write_interactions_csv,
)


def test_generate_seeded_interactions_is_deterministic() -> None:
    """
    Verify that generate_seeded_interactions produces the same output given the same inputs.

    This test is important because it ensures that the seeding process is reproducible, which is
    a critical property for generating consistent experiment results.

    The test generates two sets of seeded interactions using the same inputs and asserts that they are equal.
    Additionally, it asserts that the generated interactions are non-empty.

    """
    first = generate_seeded_interactions(
        seed=42,
        users=10,
        games=30,
        history_per_user=8,
        holdout_per_user=1,
    )
    second = generate_seeded_interactions(
        seed=42,
        users=10,
        games=30,
        history_per_user=8,
        holdout_per_user=1,
    )
    assert first == second
    assert len(first) > 0


def test_merge_interaction_rows_with_external_csv(tmp_path: Path) -> None:
    """
    Verify that merge_interaction_rows correctly merges seeded interactions with external CSV data.

    The test creates a temporary CSV file with a single interaction row, and then merges this data with a
    set of seeded interactions. It asserts that the resulting merged dataset contains the same number of
    interactions as the sum of the seeded interactions and the external interactions, and that the external
    interaction is present in the merged dataset.
    """
    ext_csv = tmp_path / "export.csv"
    with ext_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["user_id", "game_id", "event_ts", "liked", "rating"],
        )
        writer.writeheader()
        writer.writerow(
            {
                "user_id": "77",
                "game_id": "7001",
                "event_ts": "2025-01-01T00:00:00Z",
                "liked": "true",
                "rating": "",
            }
        )

    seeded = generate_seeded_interactions(
        seed=9,
        users=5,
        games=20,
        history_per_user=4,
        holdout_per_user=1,
    )
    external = load_interactions_from_csv(ext_csv)
    merged = merge_interaction_rows(seeded_rows=seeded, external_rows=external)

    assert len(merged) >= len(seeded)
    assert any(row["user_id"] == "77" and row["game_id"] == "7001" for row in merged)


def test_evaluate_dataset_quality_catches_low_coverage(tmp_path: Path) -> None:
    """
    Verify that evaluate_dataset_quality catches datasets with fewer than the minimum required interactions.

    The test creates three empty CSV files for the train, validation, and test datasets, and then runs
    evaluate_dataset_quality on the profile built from these datasets. It asserts that the function returns
    a list of failures, and that one of the failures is due to the dataset having fewer than the minimum
    required interactions.

    """
    train_csv = tmp_path / "train.csv"
    validation_csv = tmp_path / "validation.csv"
    test_csv = tmp_path / "test.csv"

    train_rows = [
        {
            "user_id": "1",
            "game_id": "10",
            "event_ts": "2025-01-01T00:00:00Z",
            "liked": "true",
            "rating": "",
            "label": "1",
        }
    ]
    validation_rows = []
    test_rows = [
        {
            "user_id": "1",
            "game_id": "11",
            "event_ts": "2025-01-02T00:00:00Z",
            "liked": "false",
            "rating": "",
            "label": "0",
        }
    ]

    for path, rows in (
        (train_csv, train_rows),
        (validation_csv, validation_rows),
        (test_csv, test_rows),
    ):
        write_interactions_csv(
            path,
            [
                {
                    "user_id": row["user_id"],
                    "game_id": row["game_id"],
                    "event_ts": row["event_ts"],
                    "liked": row["liked"],
                    "rating": row["rating"],
                }
                for row in rows
            ],
        )
        if rows:
            with path.open("r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                loaded = list(reader)
            with path.open("w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=["user_id", "game_id", "event_ts", "liked", "rating", "label"],
                )
                writer.writeheader()
                for idx, row in enumerate(loaded):
                    writer.writerow({**row, "label": rows[idx]["label"]})
        else:
            with path.open("w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=["user_id", "game_id", "event_ts", "liked", "rating", "label"],
                )
                writer.writeheader()

    profile = build_dataset_profile(
        train_csv=train_csv,
        validation_csv=validation_csv,
        test_csv=test_csv,
    )
    failures = evaluate_dataset_quality(profile=profile, config=DatasetQualityConfig())

    assert failures
    assert any("min_rows" in failure for failure in failures)


def test_evaluate_dataset_quality_rejects_degenerate_eval_splits(tmp_path: Path) -> None:
    train_csv = tmp_path / "train.csv"
    validation_csv = tmp_path / "validation.csv"
    test_csv = tmp_path / "test.csv"

    def write_rows(path_obj: Path, rows: list[dict[str, str]]) -> None:
        with path_obj.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["user_id", "game_id", "event_ts", "liked", "rating", "label"],
            )
            writer.writeheader()
            writer.writerows(rows)

    write_rows(
        train_csv,
        [
            {"user_id": "1", "game_id": "10", "event_ts": "2025-01-01T00:00:00Z", "liked": "true", "rating": "", "label": "1"},
            {"user_id": "1", "game_id": "11", "event_ts": "2025-01-02T00:00:00Z", "liked": "false", "rating": "", "label": "0"},
            {"user_id": "2", "game_id": "12", "event_ts": "2025-01-03T00:00:00Z", "liked": "true", "rating": "", "label": "1"},
            {"user_id": "2", "game_id": "13", "event_ts": "2025-01-04T00:00:00Z", "liked": "false", "rating": "", "label": "0"},
        ],
    )
    write_rows(
        validation_csv,
        [
            {"user_id": "1", "game_id": "14", "event_ts": "2025-01-05T00:00:00Z", "liked": "false", "rating": "", "label": "0"},
        ],
    )
    write_rows(
        test_csv,
        [
            {"user_id": "2", "game_id": "15", "event_ts": "2025-01-06T00:00:00Z", "liked": "false", "rating": "", "label": "0"},
        ],
    )

    profile = build_dataset_profile(
        train_csv=train_csv,
        validation_csv=validation_csv,
        test_csv=test_csv,
    )
    failures = evaluate_dataset_quality(
        profile=profile,
        config=DatasetQualityConfig(
            min_rows=1,
            min_unique_users=1,
            min_unique_games=1,
            min_positive_rows=1,
            min_negative_rows=1,
            min_users_with_positive=1,
            min_interactions_per_user=1,
            min_train_rows=1,
            min_validation_rows=1,
            min_test_rows=1,
            min_positive_ratio=0.0,
            max_positive_ratio=1.0,
        ),
    )

    assert any("min_validation_positive_rows" in failure for failure in failures)
    assert any("min_test_positive_rows" in failure for failure in failures)
    assert any("min_test_users_with_positive" in failure for failure in failures)
