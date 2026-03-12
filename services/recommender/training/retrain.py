from __future__ import annotations

import argparse
import csv
import hashlib
import importlib
import json
import logging
import os
import random
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Any

from services.recommender.models.feature_contract import FEATURE_SCHEMA_VERSION
from services.recommender.training.data_prep import run_split
from services.recommender.training.dataset_pipeline import (
    DatasetQualityConfig,
    build_dataset_profile,
    evaluate_dataset_quality,
    generate_seeded_interactions,
    load_interactions_from_csv,
    merge_interaction_rows,
    write_interactions_csv,
)
from services.recommender.training.offline_eval import run_offline_evaluation

logger = logging.getLogger(__name__)

EXIT_DATASET_QUALITY_FAILED = 2
EXIT_OFFLINE_EVAL_FAILED = 3


def _configure_logging() -> None:
    """Configure structured training logs once per process."""
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)s service=recommender component=training %(message)s",
        )
    else:
        root.setLevel(level)


def _sha256_file(path: Path) -> str:
    """
    Calculate the SHA256 hash of a file.

    Args:
        path (Path): The file path to hash.

    Returns:
        str: The hexadecimal representation of the SHA256 hash.
    """
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def _sha256_text(text: str) -> str:
    """
    Generate a SHA-256 hash of the given text.

    Args:
        text (str): The input text to be hashed.

    Returns:
        str: The hexadecimal representation of the SHA-256 hash.

    Example:
        >>> _sha256_text("hello")
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _git_commit_hash(repo_root: Path) -> str | None:
    """
    Get the current Git commit hash of the repository.

    Args:
        repo_root: The root directory path of the Git repository.

    Returns:
        The full commit hash (SHA-1) as a string if successful, or None if the
        repository is not a valid Git repository or the command fails.
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        # Git is not installed or not present in PATH for this runtime.
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


def set_global_seed(seed: int) -> dict[str, Any]:
    """
    Set the global random seed for reproducibility across multiple libraries.

    Configures the random seed for Python's built-in random module, NumPy, and TensorFlow

    to ensure reproducible results. Attempts to enable deterministic operations in TensorFlow

    if available.

    Args:

        seed (int): The seed value to use for all random number generators.

    Returns:

        dict[str, Any]: A dictionary containing the seed configuration status with keys:

            - pythonhashseed (str): The PYTHONHASHSEED environment variable value.

            - python_seed (int): The seed value applied to Python's random module.

            - numpy_seed (int or None): The seed value applied to NumPy, or None if NumPy is not available.

            - numpy_seeded (bool): Whether NumPy was successfully seeded.

            - tensorflow_seeded (bool): Whether TensorFlow was successfully seeded.

            - tensorflow_deterministic_ops (bool): Whether TensorFlow deterministic operations were enabled.
    """
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)

    numpy_seeded = False
    if importlib.util.find_spec("numpy") is not None:
        numpy_module = importlib.import_module("numpy")
        numpy_module.random.seed(seed)
        numpy_seeded = True

    tensorflow_seeded = False
    tensorflow_deterministic_ops = False
    if importlib.util.find_spec("tensorflow") is not None:
        tensorflow_module = importlib.import_module("tensorflow")
        tensorflow_module.keras.utils.set_random_seed(seed)
        tensorflow_seeded = True
        if hasattr(tensorflow_module.config, "experimental") and hasattr(
            tensorflow_module.config.experimental, "enable_op_determinism"
        ):
            tensorflow_module.config.experimental.enable_op_determinism()
            tensorflow_deterministic_ops = True

    return {
        "pythonhashseed": os.environ.get("PYTHONHASHSEED"),
        "python_seed": seed,
        "numpy_seed": seed if numpy_seeded else None,
        "numpy_seeded": numpy_seeded,
        "tensorflow_seeded": tensorflow_seeded,
        "tensorflow_deterministic_ops": tensorflow_deterministic_ops,
    }


def _load_positive_test_users(test_csv: Path) -> list[str]:
    """
    Load and return a sorted list of unique user IDs from a test CSV file that have positive labels.

    This function reads a CSV file and extracts user IDs where the 'label' column equals "1".

    User IDs are stripped of whitespace and duplicates are removed.

    Args:
        test_csv (Path): Path object pointing to the test CSV file to read.

    Returns:
        list[str]: A sorted list of unique user IDs that have a positive label ("1").

    Raises:
        FileNotFoundError: If the test_csv file does not exist.

        KeyError: If the CSV file does not contain the required 'label' or 'user_id' columns.
    """
    users: set[str] = set()
    with test_csv.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("label") != "1":
                continue
            user_id = (row.get("user_id") or "").strip()
            if user_id:
                users.add(user_id)
    return sorted(users)


def _load_train_popularity(train_csv: Path) -> tuple[dict[str, set[str]], list[str]]:
    """
    Load training data from a CSV file and compute user-game interactions and game popularity rankings.

    Args:
        train_csv (Path): Path to the CSV file containing training data with 'user_id' and 'game_id' columns.

    Returns:
        tuple[dict[str, set[str]], list[str]]: A tuple containing:

            - dict[str, set[str]]: A dictionary mapping user_id to a set of game_ids they have seen/interacted with.

            - list[str]: A list of game_ids sorted by popularity (descending) and then alphabetically by game_id.

    Note:

        Rows with missing or empty user_id or game_id values are skipped.
    """
    seen: dict[str, set[str]] = {}
    popularity: dict[str, int] = {}
    with train_csv.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            user_id = (row.get("user_id") or "").strip()
            game_id = (row.get("game_id") or "").strip()
            if not user_id or not game_id:
                continue
            seen.setdefault(user_id, set()).add(game_id)
            popularity[game_id] = popularity.get(game_id, 0) + 1

    ranked_games = [
        game_id
        for game_id, _ in sorted(popularity.items(), key=lambda item: (-item[1], item[0]))
    ]
    return seen, ranked_games


def _write_predictions_csv(
    *, train_csv: Path, test_csv: Path, output_path: Path, k: int
) -> None:
    """
    Write predictions to a CSV file based on game recommendations.

    This function generates personalized game recommendations for each user by:

    1. Loading users with positive test interactions
    2. Loading training data to identify games seen by users and their popularity ranking
    3. For each user, selecting the top-k games they haven't seen, ranked by popularity

    Args:
        train_csv: Path to the training CSV file containing user-game interactions
        test_csv: Path to the test CSV file containing positive user interactions
        output_path: Path where the predictions CSV will be written
        k: Number of top games to recommend per user

    Returns:
        None. Writes predictions to a CSV file at output_path with columns:
        - user_id: The user identifier
        - game_id: The recommended game identifier
        - rank: The recommendation rank (1 to k)

    Raises:
        FileNotFoundError: If train_csv or test_csv do not exist
        IOError: If output_path cannot be written to
    """
    users = _load_positive_test_users(test_csv)
    seen_by_user, ranked_games = _load_train_popularity(train_csv)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["user_id", "game_id", "rank"])
        writer.writeheader()
        for user_id in users:
            seen_games = seen_by_user.get(user_id, set())
            top_recommended_games = [
                game_id for game_id in ranked_games if game_id not in seen_games
            ][:k]
            for idx, game_id in enumerate(top_recommended_games, start=1):
                writer.writerow({"user_id": user_id, "game_id": game_id, "rank": idx})


def _collect_code_hash(repo_root: Path) -> str:
    """
    Generate a SHA256 hash of the combined contents of tracked training files.

    This function reads the contents of specific recommender training modules,
    concatenates them, and returns their SHA256 hash. This hash can be used to
    detect changes in the training code and trigger retraining when needed.

    Args:
        repo_root (Path): The root directory path of the repository.

    Returns:
        str: A SHA256 hash string representing the combined contents of all
             tracked training files.

    Raises:
        FileNotFoundError: If any of the tracked files do not exist.
        UnicodeDecodeError: If any file cannot be decoded as UTF-8.
    """
    tracked_files = [
        repo_root / "services/recommender/training/retrain.py",
        repo_root / "services/recommender/training/data_prep.py",
        repo_root / "services/recommender/training/offline_eval.py",
    ]
    blob = "\n".join(path.read_text(encoding="utf-8") for path in tracked_files)
    return _sha256_text(blob)

def _resolve_repo_root(start_file: Path) -> Path:
    """
    Resolve repository root by walking parents until expected repo markers are found.
    """
    candidate = start_file.resolve().parent
    for directory in [candidate, *candidate.parents]:
        if (directory / "deploy" / "docker-compose.yml").exists() and (
            directory / "services" / "recommender" / "training" / "retrain.py"
        ).exists():
            return directory
    # Fallback to historical assumption if markers are unavailable.
    return start_file.resolve().parents[4]

def _write_artifact_bundle(
    *,
    run_dir: Path,
    run_id: str,
    train_csv: Path,
    seed: int,
    train_ratio: float,
    validation_ratio: float,
    k: int,
    dataset_hash: str,
) -> dict[str, Any]:
    """
    Write an artifact bundle to disk containing model metadata, candidate index mapping, and a reserved .keras model path.

    The bundle is a directory containing the following files:

    - `candidate_index_map.json`: A JSON file containing the mapping from candidate index to game ID.
    - `artifact_manifest.json`: A JSON file containing the model version, feature schema version, candidate index mapping path, training config, random seed, and dataset hash.
    - `recommender_<artifact_version>.keras`: A reserved file path for the future model output from the trainer.

    The function returns a dictionary containing the following keys:

    - `artifact_version`: The artifact version string.
    - `bundle_dir`: The path to the artifact bundle directory.
    - `model_path`: The path to the reserved .keras model file.
    - `model_exists`: A boolean indicating whether the model file exists.
    - `model_stub_metadata`: A dictionary containing the model stub status and note.
    - `manifest_path`: The path to the artifact manifest JSON file.
    - `candidate_index_map_path`: The path to the candidate index mapping JSON file.

    Args:
        run_dir (Path): The root directory path of the repository.
        run_id (str): The run ID string.
        train_csv (Path): The path to the training CSV file.
        seed (int): The random seed used for training.
        train_ratio (float): The ratio of training examples to total examples.
        validation_ratio (float): The ratio of validation examples to total examples.
        k (int): The number of recommended games per user.
        dataset_hash (str): The SHA256 hash of the dataset.

    Returns:
        dict[str, Any]: A dictionary containing the artifact bundle metadata.
    """
    artifact_version = run_id
    bundle_dir = run_dir / "artifacts" / artifact_version
    bundle_dir.mkdir(parents=True, exist_ok=True)
    
    candidate_map_path = bundle_dir / "candidate_index_map.json"
    _seen_by_user, ranked_games = _load_train_popularity(train_csv)
    candidate_index_map: dict[str, int] = {}
    for candidate_index, game_id in enumerate(ranked_games, start=1):
        try:
            candidate_index_map[str(candidate_index)] = int(game_id)
        except ValueError:
            continue
    candidate_map_path.write_text(json.dumps(candidate_index_map, indent=4), encoding="utf-8")
    
    model_path = bundle_dir / f"recommender_{artifact_version}.keras"
    manifest_path = bundle_dir / "artifact_manifest.json"
    manifest_payload = {
        "model_version": artifact_version,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "candidate_index_map_path": candidate_map_path.name,
        "training_config": {
            "train_ratio": train_ratio,
            "validation_ratio": validation_ratio,
            "k": k,
            "model_format": ".keras",
        },
        "random_seed": seed,
        "dataset_hash": dataset_hash,
    }
    manifest_path.write_text(json.dumps(manifest_payload, indent=4), encoding="utf-8")
    
    model_stub_metadata = {
        "status": "pending_training_output",
        "note": "Model training is baseline-stubbed; .keras artifact path is reserved for future trainer output.",
    }
    
    return {
        "artifact_version": artifact_version,
        "bundle_dir": str(bundle_dir),
        "model_path": str(model_path),
        "model_exists": model_path.exists(),
        "model_stub_metadata": model_stub_metadata,
        "manifest_path": str(manifest_path),
        "candidate_index_map_path": str(candidate_map_path),
    }

def _build_training_rows(
    train_csv: Path,
    candidate_to_index: dict[int, int],
) -> tuple[list[list[float]], list[int]]:
    """
    Build simple user-history features and positive-class targets for multiclass training.

    The feature order intentionally matches feature_contract.py:
    [liked_keyword_count, liked_platform_count, disliked_keyword_count, disliked_platform_count]
    """
    features: list[list[float]] = []
    targets: list[int] = []

    positive_counts: dict[str, int] = {}
    negative_counts: dict[str, int] = {}
    seen_counts: dict[str, int] = {}

    with train_csv.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            user_id = (row.get("user_id") or "").strip()
            game_id_raw = (row.get("game_id") or "").strip()
            label_raw = (row.get("label") or "").strip()
            if not user_id or not game_id_raw or label_raw not in {"0", "1"}:
                continue

            try:
                game_id = int(game_id_raw)
            except ValueError:
                continue

            liked_so_far = positive_counts.get(user_id, 0)
            disliked_so_far = negative_counts.get(user_id, 0)
            seen_so_far = seen_counts.get(user_id, 0)

            # Keep feature semantics stable with the runtime contract.
            row_features = [
                float(liked_so_far),
                float(seen_so_far),
                float(disliked_so_far),
                float(disliked_so_far),
            ]

            if label_raw == "1":
                candidate_index = candidate_to_index.get(game_id)
                if candidate_index is not None:
                    features.append(row_features)
                    # Keras sparse categorical targets are zero-based class indices.
                    targets.append(candidate_index - 1)
                positive_counts[user_id] = liked_so_far + 1
            else:
                negative_counts[user_id] = disliked_so_far + 1

            seen_counts[user_id] = seen_so_far + 1

    return features, targets

def _train_and_save_model(
    *,
    train_csv: Path,
    candidate_index_map_path: Path,
    model_path: Path,
    seed: int,
    epochs: int,
    batch_size: int,
) -> dict[str, Any]:
    """
    Train a minimal Keras multiclass model and save it as a .keras artifact.
    """
    with candidate_index_map_path.open("r", encoding="utf-8") as f:
        raw_candidate_map = json.load(f)
    candidate_index_map = {int(k): int(v) for k, v in raw_candidate_map.items()}
    candidate_to_index = {game_id: candidate_index for candidate_index, game_id in candidate_index_map.items()}

    features, targets = _build_training_rows(train_csv, candidate_to_index)
    if not features or not targets:
        raise RuntimeError("No positive training rows available to fit model.")

    tf_module = importlib.import_module("tensorflow")
    np_module = importlib.import_module("numpy")

    tf_module.keras.utils.set_random_seed(seed)
    if hasattr(tf_module.config, "experimental") and hasattr(
        tf_module.config.experimental, "enable_op_determinism"
    ):
        tf_module.config.experimental.enable_op_determinism()

    x_train = np_module.asarray(features, dtype="float32")
    y_train = np_module.asarray(targets, dtype="int32")
    num_classes = int(max(targets) + 1)

    model = tf_module.keras.Sequential(
        [
            tf_module.keras.layers.Input(shape=(4,), name="features"),
            tf_module.keras.layers.Dense(32, activation="relu"),
            tf_module.keras.layers.Dense(16, activation="relu"),
            tf_module.keras.layers.Dense(num_classes, activation="softmax", name="scores"),
        ]
    )
    model.compile(
        optimizer=tf_module.keras.optimizers.Adam(learning_rate=0.01),
        loss="sparse_categorical_crossentropy",
    )

    history = model.fit(
        x_train,
        y_train,
        epochs=max(1, epochs),
        batch_size=max(1, min(batch_size, len(features))),
        verbose=2,
    )

    model_path.parent.mkdir(parents=True, exist_ok=True)
    model.save(model_path)

    final_loss = float(history.history["loss"][-1]) if history.history.get("loss") else None
    return {
        "rows": len(features),
        "num_classes": num_classes,
        "epochs": max(1, epochs),
        "batch_size": max(1, min(batch_size, len(features))),
        "final_loss": final_loss,
        "model_saved": model_path.exists(),
    }

def _promote_artifacts_to_current(*, run_log: dict[str, Any], repo_root: Path) -> dict[str, str]:
    """
    Copy model + manifest + candidate map from a run bundle into the serving-current folder.
    """
    artifacts = run_log["artifacts"]
    source_model = Path(artifacts["model_path"])
    source_manifest = Path(artifacts["manifest_path"])
    source_candidate_map = Path(artifacts["candidate_index_map_path"])

    current_dir = repo_root / "services/recommender/training/artifacts/current"
    current_dir.mkdir(parents=True, exist_ok=True)

    target_model = current_dir / "model.keras"
    target_manifest = current_dir / "artifact_manifest.json"
    target_candidate_map = current_dir / "candidate_index_map.json"

    shutil.copy2(source_model, target_model)
    shutil.copy2(source_manifest, target_manifest)
    shutil.copy2(source_candidate_map, target_candidate_map)

    manifest_payload = json.loads(target_manifest.read_text(encoding="utf-8"))
    manifest_payload["candidate_index_map_path"] = target_candidate_map.name
    target_manifest.write_text(json.dumps(manifest_payload, indent=4), encoding="utf-8")

    return {
        "current_dir": str(current_dir),
        "model_path": str(target_model),
        "manifest_path": str(target_manifest),
        "candidate_index_map_path": str(target_candidate_map),
    }


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=4), encoding="utf-8")


def _prepare_input_dataset(
    *,
    source_mode: str,
    input_csv: Path | None,
    db_export_csv: Path | None,
    run_dir: Path,
    seed: int,
    seed_users: int,
    seed_games: int,
    seed_history_per_user: int,
    seed_holdout_per_user: int,
) -> tuple[Path, dict[str, Any]]:
    include_seeded = source_mode in {"seeded_only", "seeded_plus_db"}
    include_external = source_mode in {"db_only", "seeded_plus_db"}

    seeded_rows: list[dict[str, str]] = []
    if include_seeded:
        seeded_rows = generate_seeded_interactions(
            seed=seed,
            users=seed_users,
            games=seed_games,
            history_per_user=seed_history_per_user,
            holdout_per_user=seed_holdout_per_user,
        )

    external_rows: list[dict[str, str]] = []
    external_sources: list[str] = []
    if include_external:
        if input_csv is not None and input_csv.exists():
            external_rows.extend(load_interactions_from_csv(input_csv))
            external_sources.append(str(input_csv))
        if db_export_csv is not None and db_export_csv.exists():
            external_rows.extend(load_interactions_from_csv(db_export_csv))
            external_sources.append(str(db_export_csv))
        if source_mode == "db_only" and not external_rows:
            raise ValueError("source_mode=db_only requires --input_csv or --db_export_csv")

    merged_rows = merge_interaction_rows(seeded_rows=seeded_rows, external_rows=external_rows)
    if not merged_rows:
        raise ValueError("No valid interaction rows found after source ingestion/merge.")

    merged_csv = run_dir / "input" / "merged_input.csv"
    write_interactions_csv(merged_csv, merged_rows)
    return merged_csv, {
        "source_mode": source_mode,
        "seeded_rows": len(seeded_rows),
        "external_rows": len(external_rows),
        "merged_rows": len(merged_rows),
        "external_sources": external_sources,
        "merged_input_csv": str(merged_csv),
    }


def _build_quality_config(
    *,
    min_rows: int,
    min_unique_users: int,
    min_unique_games: int,
    min_positive_rows: int,
    min_negative_rows: int,
    min_users_with_positive: int,
    min_interactions_per_user: int,
    min_train_rows: int,
    min_validation_rows: int,
    min_test_rows: int,
    min_positive_ratio: float,
    max_positive_ratio: float,
) -> DatasetQualityConfig:
    return DatasetQualityConfig(
        min_rows=min_rows,
        min_unique_users=min_unique_users,
        min_unique_games=min_unique_games,
        min_positive_rows=min_positive_rows,
        min_negative_rows=min_negative_rows,
        min_users_with_positive=min_users_with_positive,
        min_interactions_per_user=min_interactions_per_user,
        min_train_rows=min_train_rows,
        min_validation_rows=min_validation_rows,
        min_test_rows=min_test_rows,
        min_positive_ratio=min_positive_ratio,
        max_positive_ratio=max_positive_ratio,
    )


def _build_gate_result(
    *,
    passed: bool,
    code: str,
    gate_failures: list[str],
    run_id: str,
    dataset_profile_path: Path,
) -> dict[str, Any]:
    return {
        "run_id": run_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "passed": passed,
        "status": "pass" if passed else "fail",
        "code": code,
        "gate_failures": gate_failures,
        "dataset_profile_path": str(dataset_profile_path),
    }

def run_experiment(
    *,
    run_dir: Path,
    train_ratio: float,
    validation_ratio: float,
    threshold_json: Path,
    k: int,
    seed: int,
    repo_root: Path,
    input_csv: Path | None = None,
    db_export_csv: Path | None = None,
    source_mode: str = "seeded_plus_db",
    seed_users: int = 24,
    seed_games: int = 80,
    seed_history_per_user: int = 12,
    seed_holdout_per_user: int = 1,
    min_rows: int = 60,
    min_unique_users: int = 8,
    min_unique_games: int = 20,
    min_positive_rows: int = 20,
    min_negative_rows: int = 20,
    min_users_with_positive: int = 6,
    min_interactions_per_user: int = 4,
    min_train_rows: int = 30,
    min_validation_rows: int = 5,
    min_test_rows: int = 5,
    min_positive_ratio: float = 0.15,
    max_positive_ratio: float = 0.85,
    epochs: int = 12,
    batch_size: int = 32,
    promote_current: bool = False,
) -> dict[str, Any]:
    """Run one reproducible training/evaluation experiment with data-quality and promotion gates."""
    run_started = perf_counter()
    run_dir.mkdir(parents=True, exist_ok=True)
    prepared_dir = run_dir / "prepared"
    predictions_dir = run_dir / "predictions"

    logger.info(
        "retrain.run_started run_id=%s source_mode=%s run_dir=%s train_ratio=%.3f validation_ratio=%.3f epochs=%s batch_size=%s seed=%s k=%s",
        run_dir.name,
        source_mode,
        run_dir.as_posix(),
        train_ratio,
        validation_ratio,
        epochs,
        batch_size,
        seed,
        k,
    )

    seeding = set_global_seed(seed)
    merged_input_csv, source_summary = _prepare_input_dataset(
        source_mode=source_mode,
        input_csv=input_csv,
        db_export_csv=db_export_csv,
        run_dir=run_dir,
        seed=seed,
        seed_users=seed_users,
        seed_games=seed_games,
        seed_history_per_user=seed_history_per_user,
        seed_holdout_per_user=seed_holdout_per_user,
    )

    split_started = perf_counter()
    manifest = run_split(
        input_csv=merged_input_csv,
        output_dir=prepared_dir,
        train_ratio=train_ratio,
        validation_ratio=validation_ratio,
    )
    logger.info(
        "retrain.split_completed run_id=%s train_rows=%s validation_rows=%s test_rows=%s source_sha256=%s latency_ms=%.2f",
        run_dir.name,
        manifest.get("row_counts", {}).get("train"),
        manifest.get("row_counts", {}).get("validation"),
        manifest.get("row_counts", {}).get("test"),
        manifest.get("source_sha256"),
        (perf_counter() - split_started) * 1000,
    )

    train_csv = prepared_dir / "train.csv"
    validation_csv = prepared_dir / "validation.csv"
    test_csv = prepared_dir / "test.csv"
    predictions_csv = predictions_dir / "predictions.csv"

    dataset_profile = build_dataset_profile(
        train_csv=train_csv,
        validation_csv=validation_csv,
        test_csv=test_csv,
    )
    quality_config = _build_quality_config(
        min_rows=min_rows,
        min_unique_users=min_unique_users,
        min_unique_games=min_unique_games,
        min_positive_rows=min_positive_rows,
        min_negative_rows=min_negative_rows,
        min_users_with_positive=min_users_with_positive,
        min_interactions_per_user=min_interactions_per_user,
        min_train_rows=min_train_rows,
        min_validation_rows=min_validation_rows,
        min_test_rows=min_test_rows,
        min_positive_ratio=min_positive_ratio,
        max_positive_ratio=max_positive_ratio,
    )
    dataset_failures = evaluate_dataset_quality(profile=dataset_profile, config=quality_config)

    dataset_profile_payload = {
        "run_id": run_dir.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": source_summary,
        "quality_thresholds": quality_config.__dict__,
        "profile": dataset_profile,
        "quality_passed": len(dataset_failures) == 0,
        "quality_failures": dataset_failures,
    }
    dataset_profile_path = run_dir / "dataset_profile.json"
    _write_json(dataset_profile_path, dataset_profile_payload)

    artifacts: dict[str, Any] | None = None
    training: dict[str, Any] | None = None
    eval_result: dict[str, Any] | None = None
    gate_result: dict[str, Any]

    if dataset_failures:
        gate_result = _build_gate_result(
            passed=False,
            code="dataset_quality_failed",
            gate_failures=dataset_failures,
            run_id=run_dir.name,
            dataset_profile_path=dataset_profile_path,
        )
    else:
        artifacts = _write_artifact_bundle(
            run_dir=run_dir,
            run_id=run_dir.name,
            train_csv=train_csv,
            seed=seed,
            train_ratio=train_ratio,
            validation_ratio=validation_ratio,
            k=k,
            dataset_hash=manifest["source_sha256"],
        )

        train_started = perf_counter()
        training = _train_and_save_model(
            train_csv=train_csv,
            candidate_index_map_path=Path(artifacts["candidate_index_map_path"]),
            model_path=Path(artifacts["model_path"]),
            seed=seed,
            epochs=epochs,
            batch_size=batch_size,
        )
        logger.info(
            "retrain.training_completed run_id=%s model_path=%s latency_ms=%.2f",
            run_dir.name,
            artifacts["model_path"],
            (perf_counter() - train_started) * 1000,
        )
        artifacts["model_exists"] = Path(artifacts["model_path"]).exists()
        artifacts["model_stub_metadata"] = {
            "status": "trained",
            "note": "Model fit completed and .keras artifact was written.",
        }

        predict_started = perf_counter()
        _write_predictions_csv(
            train_csv=train_csv,
            test_csv=test_csv,
            output_path=predictions_csv,
            k=k,
        )
        logger.info(
            "retrain.predictions_completed run_id=%s predictions_csv=%s latency_ms=%.2f",
            run_dir.name,
            predictions_csv.as_posix(),
            (perf_counter() - predict_started) * 1000,
        )

        eval_started = perf_counter()
        eval_result = run_offline_evaluation(
            train_csv=train_csv,
            test_csv=test_csv,
            predictions_csv=predictions_csv,
            thresholds_json=threshold_json,
            k=k,
        )
        model_metrics = eval_result.get("model", {})
        logger.info(
            "retrain.offline_eval_completed run_id=%s passed=%s precision_at_k=%.6f recall_at_k=%.6f map_at_k=%.6f latency_ms=%.2f",
            run_dir.name,
            bool(eval_result.get("passed")),
            float(model_metrics.get("precision_at_k", 0.0)),
            float(model_metrics.get("recall_at_k", 0.0)),
            float(model_metrics.get("map_at_k", 0.0)),
            (perf_counter() - eval_started) * 1000,
        )

        gate_result = _build_gate_result(
            passed=bool(eval_result.get("passed")),
            code="ok" if bool(eval_result.get("passed")) else "offline_eval_failed",
            gate_failures=list(eval_result.get("gate_failures", [])),
            run_id=run_dir.name,
            dataset_profile_path=dataset_profile_path,
        )

    gate_result_path = run_dir / "gate_result.json"
    _write_json(gate_result_path, gate_result)

    evaluation_passed = bool(gate_result["passed"])
    promoted_at = datetime.now(timezone.utc).isoformat() if evaluation_passed else None

    promotion = {
        "eligible": evaluation_passed,
        "status": "promoted" if evaluation_passed else gate_result["code"],
        "promoted": False,
        "promoted_at": None,
    }
    if artifacts is not None:
        promotion.update(
            {
                "artifact_version": artifacts["artifact_version"],
                "bundle_dir": artifacts["bundle_dir"],
                "model_path": artifacts["model_path"],
                "manifest_path": artifacts["manifest_path"],
                "candidate_index_map_path": artifacts["candidate_index_map_path"],
            }
        )

    run_log = {
        "run_id": run_dir.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "params": {
            "input_csv": str(input_csv) if input_csv else None,
            "db_export_csv": str(db_export_csv) if db_export_csv else None,
            "source_mode": source_mode,
            "seed": seed,
            "train_ratio": train_ratio,
            "validation_ratio": validation_ratio,
            "k": k,
            "epochs": epochs,
            "batch_size": batch_size,
            "thresholds_json": str(threshold_json),
            "seed_users": seed_users,
            "seed_games": seed_games,
            "seed_history_per_user": seed_history_per_user,
            "seed_holdout_per_user": seed_holdout_per_user,
            "dataset_quality_thresholds": quality_config.__dict__,
        },
        "seeding": seeding,
        "dataset_profile": {
            "path": str(dataset_profile_path),
            "quality_passed": len(dataset_failures) == 0,
            "quality_failures": dataset_failures,
            "summary": dataset_profile,
        },
        "training": training,
        "metrics": eval_result,
        "gate_result": {
            **gate_result,
            "path": str(gate_result_path),
        },
        "artifacts": artifacts,
        "promotion": promotion,
        "hashes": {
            "dataset_source_sha256": manifest["source_sha256"],
            "train_csv_sha256": _sha256_file(train_csv),
            "validation_csv_sha256": _sha256_file(validation_csv),
            "test_csv_sha256": _sha256_file(test_csv),
            "predictions_csv_sha256": _sha256_file(predictions_csv)
            if predictions_csv.exists()
            else None,
            "training_code_sha256": _collect_code_hash(repo_root),
            "git_commit": _git_commit_hash(repo_root),
        },
    }

    if promote_current and evaluation_passed and artifacts is not None:
        run_log["current_artifacts"] = _promote_artifacts_to_current(
            run_log=run_log,
            repo_root=repo_root,
        )
        run_log["promotion"]["promoted"] = True
        run_log["promotion"]["promoted_at"] = promoted_at

    run_log_path = run_dir / "run_log.json"
    _write_json(run_log_path, run_log)

    logger.info(
        "retrain.run_completed run_id=%s gate_code=%s passed=%s run_log=%s total_latency_ms=%.2f",
        run_dir.name,
        gate_result["code"],
        evaluation_passed,
        run_log_path.as_posix(),
        (perf_counter() - run_started) * 1000,
    )

    return run_log


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="One-command reproducible recommender retraining."
    )
    parser.add_argument(
        "--input_csv",
        type=Path,
        required=False,
        default=None,
        help="Optional path to interactions CSV to merge into the training source.",
    )
    parser.add_argument(
        "--db_export_csv",
        type=Path,
        default=None,
        help="Optional DB-export interactions CSV to merge with seeded fixtures.",
    )
    parser.add_argument(
        "--source_mode",
        type=str,
        choices=["seeded_only", "db_only", "seeded_plus_db"],
        default="seeded_plus_db",
        help="Select interaction source strategy for this run.",
    )
    parser.add_argument(
        "--runs_dir",
        type=Path,
        default=Path("services/recommender/training/runs"),
        help="Directory for run artifacts/logs.",
    )
    parser.add_argument(
        "--run_id",
        type=str,
        default=None,
        help="Optional run id; defaults to UTC timestamp.",
    )
    parser.add_argument("--train_ratio", type=float, default=0.8, help="Train split ratio.")
    parser.add_argument(
        "--validation_ratio", type=float, default=0.1, help="Validation split ratio."
    )
    parser.add_argument(
        "--thresholds_json",
        type=Path,
        default=Path("services/recommender/training/offline_eval_thresholds.json"),
        help="Offline eval thresholds JSON path.",
    )
    parser.add_argument("--k", type=int, default=10, help="Top-k for ranking metrics.")
    parser.add_argument(
        "--epochs", type=int, default=12, help="Number of Keras training epochs."
    )
    parser.add_argument("--batch_size", type=int, default=32, help="Training batch size.")
    parser.add_argument("--seed", type=int, default=42, help="Global random seed.")

    parser.add_argument("--seed_users", type=int, default=24)
    parser.add_argument("--seed_games", type=int, default=80)
    parser.add_argument("--seed_history_per_user", type=int, default=12)
    parser.add_argument("--seed_holdout_per_user", type=int, default=1)

    parser.add_argument("--min_rows", type=int, default=60)
    parser.add_argument("--min_unique_users", type=int, default=8)
    parser.add_argument("--min_unique_games", type=int, default=20)
    parser.add_argument("--min_positive_rows", type=int, default=20)
    parser.add_argument("--min_negative_rows", type=int, default=20)
    parser.add_argument("--min_users_with_positive", type=int, default=6)
    parser.add_argument("--min_interactions_per_user", type=int, default=4)
    parser.add_argument("--min_train_rows", type=int, default=30)
    parser.add_argument("--min_validation_rows", type=int, default=5)
    parser.add_argument("--min_test_rows", type=int, default=5)
    parser.add_argument("--min_positive_ratio", type=float, default=0.15)
    parser.add_argument("--max_positive_ratio", type=float, default=0.85)

    parser.add_argument(
        "--promote_current",
        action="store_true",
        help="Copy trained model + manifest + candidate map into services/recommender/training/artifacts/current when all gates pass",
    )
    return parser.parse_args()


def main():
    """
    Entry point for the recommender retraining script.

    Parses command-line arguments using _parse_args(), runs the experiment using run_experiment(), and prints the result as a JSON object.

    If the experiment fails to pass the offline evaluation acceptance criteria, raises SystemExit(1).

    :return: None
    :rtype: None
    """
    _configure_logging()
    args = _parse_args()
    run_id = args.run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = args.runs_dir / run_id
    repo_root = _resolve_repo_root(Path(__file__))

    result = run_experiment(
        input_csv=args.input_csv,
        db_export_csv=args.db_export_csv,
        source_mode=args.source_mode,
        run_dir=run_dir,
        train_ratio=args.train_ratio,
        validation_ratio=args.validation_ratio,
        threshold_json=args.thresholds_json,
        k=args.k,
        seed=args.seed,
        repo_root=repo_root,
        seed_users=args.seed_users,
        seed_games=args.seed_games,
        seed_history_per_user=args.seed_history_per_user,
        seed_holdout_per_user=args.seed_holdout_per_user,
        min_rows=args.min_rows,
        min_unique_users=args.min_unique_users,
        min_unique_games=args.min_unique_games,
        min_positive_rows=args.min_positive_rows,
        min_negative_rows=args.min_negative_rows,
        min_users_with_positive=args.min_users_with_positive,
        min_interactions_per_user=args.min_interactions_per_user,
        min_train_rows=args.min_train_rows,
        min_validation_rows=args.min_validation_rows,
        min_test_rows=args.min_test_rows,
        min_positive_ratio=args.min_positive_ratio,
        max_positive_ratio=args.max_positive_ratio,
        epochs=args.epochs,
        batch_size=args.batch_size,
        promote_current=args.promote_current,
    )

    print(json.dumps(result, indent=4))
    gate_code = (result.get("gate_result") or {}).get("code")
    if gate_code == "dataset_quality_failed":
        logger.warning(
            "retrain.dataset_quality_gate_failed run_id=%s status=%s",
            run_dir.name,
            result["promotion"]["status"],
        )
        raise SystemExit(EXIT_DATASET_QUALITY_FAILED)
    if gate_code == "offline_eval_failed":
        logger.warning(
            "retrain.offline_gate_failed run_id=%s status=%s",
            run_dir.name,
            result["promotion"]["status"],
        )
        raise SystemExit(EXIT_OFFLINE_EVAL_FAILED)


if __name__ == "__main__":
    main()











