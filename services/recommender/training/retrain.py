from __future__ import annotations

import argparse
import csv
import hashlib
import importlib
import json
import os
import random
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from services.recommender.models.feature_contract import FEATURE_SCHEMA_VERSION
from services.recommender.training.data_prep import run_split
from services.recommender.training.offline_eval import run_offline_evaluation


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
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=repo_root,
        check=False,
        capture_output=True,
        text=True,
    )
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

def run_experiment(
    *,
    input_csv: Path,
    run_dir: Path,
    train_ratio: float,
    validation_ratio: float,
    threshold_json: Path,
    k: int,
    seed: int,
    repo_root: Path,
    epochs: int = 12,
    batch_size: int = 32,
    promote_current: bool = False,
) -> dict[str, Any]:
    """
    Runs an experiment with the recommender model.

    This function performs the following steps:

    1. Splits the input CSV into training, validation, and test sets using the given ratios.
    2. Writes the split data to separate CSV files in the "prepared" directory.
    3. Computes the popularity baseline and writes the predictions to a CSV file in the "predictions" directory.

    Args:
        input_csv (Path): The path to the input CSV file.
        run_dir (Path): The directory where experiment results should be saved.
        train_ratio (float): The proportion of data to allocate to the training set.
        validation_ratio (float): The proportion of data to allocate to the validation set.
        threshold_json (Path): The path to the JSON file containing the threshold values.
        k (int): The number of recommendations to generate.
        seed (int): The random seed to use for reproducibility.
        repo_root (Path): The root directory path of the repository.

    Returns:
        dict[str, Any]: A manifest dictionary containing metadata about the experiment, including the source file path, row counts for each split, and the SHA-256 hash of the source file.
    """
    run_dir.mkdir(parents=True, exist_ok=True)
    prepared_dir = run_dir / "prepared"
    predictions_dir = run_dir / "predictions"

    seeding = set_global_seed(seed)
    manifest = run_split(
        input_csv=input_csv,
        output_dir=prepared_dir,
        train_ratio=train_ratio,
        validation_ratio=validation_ratio,
    )

    train_csv = prepared_dir / "train.csv"
    test_csv = prepared_dir / "test.csv"

    predictions_csv = predictions_dir / "predictions.csv"

    _write_predictions_csv(
        train_csv=train_csv,
        test_csv=test_csv,
        output_path=predictions_csv,
        k=k,
    )

    eval_result = run_offline_evaluation(
        train_csv=train_csv,
        test_csv=test_csv,
        predictions_csv=predictions_csv,
        thresholds_json=threshold_json,
        k=k,
    )
    
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

    training = _train_and_save_model(
        train_csv=train_csv,
        candidate_index_map_path=Path(artifacts["candidate_index_map_path"]),
        model_path=Path(artifacts["model_path"]),
        seed=seed,
        epochs=epochs,
        batch_size=batch_size,
    )
    artifacts["model_exists"] = Path(artifacts["model_path"]).exists()
    artifacts["model_stub_metadata"] = {
        "status": "trained",
        "note": "Model fit completed and .keras artifact was written.",
    }

    evaluation_passed = bool(eval_result["passed"])
    promoted_at = datetime.now(timezone.utc).isoformat() if evaluation_passed else None

    run_log = {
        "run_id": run_dir.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "params": {
            "seed": seed,
            "train_ratio": train_ratio,
            "validation_ratio": validation_ratio,
            "k": k,
            "epochs": epochs,
            "batch_size": batch_size,
            "thresholds_json": str(threshold_json),
        },
        "seeding": seeding,
        "training": training,
        "metrics": eval_result,
        "artifacts": artifacts,
        "promotion": {
            "eligible": evaluation_passed,
            "status": "promoted" if evaluation_passed else "blocked_offline_thresholds",
            "promoted": evaluation_passed,
            "promoted_at": promoted_at,
            "artifact_version": artifacts["artifact_version"],
            "bundle_dir": artifacts["bundle_dir"],
            "model_path": artifacts["model_path"],
            "manifest_path": artifacts["manifest_path"],
            "candidate_index_map_path": artifacts["candidate_index_map_path"],
        },
        "hashes": {
            "dataset_source_sha256": manifest["source_sha256"],
            "train_csv_sha256": _sha256_file(train_csv),
            "test_csv_sha256": _sha256_file(test_csv),
            "predictions_csv_sha256": _sha256_file(predictions_csv),
            "training_code_sha256": _collect_code_hash(repo_root),
            "git_commit": _git_commit_hash(repo_root),
        },
    }
    if promote_current:
        run_log["current_artifacts"] = _promote_artifacts_to_current(
            run_log=run_log,
            repo_root=repo_root,
        )

    run_log_path = run_dir / "run_log.json"
    run_log_path.write_text(json.dumps(run_log, indent=4), encoding="utf-8")

    return run_log


def _parse_args() -> argparse.Namespace:
    """
    Parses command-line arguments for the recommender retraining script.

    The script requires an input CSV file path, but all other parameters have default values.
    The default output directory is "services/recommender/training/runs",
    and the default run ID is the current UTC timestamp.
    The default train and validation split ratios are 0.8 and 0.1, respectively.
    The default thresholds JSON file path is "services/recommender/training/offline_eval_thresholds.json".
    The default value for k is 10, and the default global random seed is 42.
    """
    parser = argparse.ArgumentParser(
        description="One-command reproducible recommender retraining."
    )
    parser.add_argument(
        "--input_csv", type=Path, required=True, help="Path to raw interactions CSV."
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
    parser.add_argument("--epochs", type=int, default=12, help="Number of Keras training epochs.")
    parser.add_argument("--batch_size", type=int, default=32, help="Training batch size.")
    parser.add_argument("--seed", type=int, default=42, help="Global random seed.")
    parser.add_argument(
        "--promote_current",
        action="store_true",
        help="Copy trained model + manifest + candidate map into services/recommender/training/artifacts/current",
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
    args = _parse_args()
    run_id = args.run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = args.runs_dir / run_id
    repo_root = _resolve_repo_root(Path(__file__))

    result = run_experiment(
        input_csv=args.input_csv,
        run_dir=run_dir,
        train_ratio=args.train_ratio,
        validation_ratio=args.validation_ratio,
        threshold_json=args.thresholds_json,
        k=args.k,
        seed=args.seed,
        repo_root=repo_root,
        epochs=args.epochs,
        batch_size=args.batch_size,
        promote_current=args.promote_current,
    )

    print(json.dumps(result, indent=4))
    if not result["metrics"]["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
