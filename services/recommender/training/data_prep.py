from __future__ import annotations

import argparse
import csv
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

SPLITTER_VERSION = "section1_splitter_v1"

@dataclass(frozen=True)
class PreparedRow:
    """
    Represents a row of prepared data with associated metadata.
    """
    row: dict[str, str]
    timestamp: datetime

def _parse_iso8601(ts: str) -> datetime:
    """
    This will parse an ISO8601 timestamp string and return a timezone-aware datetime object. 
    It handles timestamps with 'Z' (indicating UTC) and those with explicit timezone offsets. If the timestamp does not include timezone information, it will be treated as UTC.

    Args:
        ts (str): this is the ISO8601 timestamp string to parse

    Returns:
        datetime: returns a timezone-aware datetime object representing the parsed timestamp
    """
    normalized = ts.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)

def _parse_bool(value: str | None) -> bool | None:
    """Helper function to parse boolean values from strings. It recognizes common representations of true and false, and returns None for unrecognized or missing values."""
    if value is None:
        return None
    lowered = value.strip().lower()
    if lowered in {"true", "1", "yes"}:
        return True
    if lowered in {"false", "0", "no"}:
        return False
    return None

def infer_label(row: dict[str, str]) -> int | None:
    """
    this calls the label inference logic to determine whether a given row of data indicates a "liked" or "disliked" item. 
    It first checks for an explicit "liked" field, and if that is not present or ambiguous, it falls back to using a "rating" field to infer the label. The function returns 1 for liked items, 0 for disliked items, and None for cases where the label cannot be determined with confidence.

    Args:
        row (dict[str, str]): the rows of data processed in

    Returns:
        int | None: returns 1 if the item is liked, 0 if disliked, and None if the label is ambiguous or missing.
    """
    liked = _parse_bool(row.get("liked"))
    rating_raw = row.get("rating")
    
    if liked is True:
        return 1
    if liked is False:
        return 0
    
    if rating_raw is None or rating_raw.strip() == "":
        return None
    
    try:
        rating = float(rating_raw)
    except ValueError:
        return None
    
    if rating >= 4.0:
        return 1
    if rating <= 2.0:
        return 0
    return None

def _read_row(path: Path) -> list[PreparedRow]:
    """
    Reads a CSV file from the specified path and processes each row to extract relevant information and infer labels. 
    The function returns a list of PreparedRow objects, each containing the original row data and a timestamp indicating when the row was processed.

    Args:
        path (Path): the path to the CSV file to read
    Returns:
        list[PreparedRow]: returns a list of PreparedRow objects representing the processed rows from the
        CSV file.
    """
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        required_columns = {"user_id", "game_id", "event_ts"}
        if not required_columns.issubset(set(reader.fieldnames or [])):
            missing = sorted(required_columns - set(reader.fieldnames or []))
            raise ValueError(f"CSV file is missing required columns: {missing}")
        
        processed_rows: list[PreparedRow] = []
        for row in reader:
            timestamp = _parse_iso8601(row["event_ts"])
            label = infer_label(row)
            if label is None:
                continue
            
            row_with_label = dict(row)
            row_with_label["label"] = str(label)
            processed_rows.append(PreparedRow(row=row_with_label, timestamp=timestamp))
    
    processed_rows.sort(key=lambda prepared: prepared.timestamp)
    return processed_rows

def _split_row(rows: list[PreparedRow], train_ratio: float, validation_ratio: float) -> tuple[list[PreparedRow], list[PreparedRow], list[PreparedRow]]:
    """
    This function takes a list of PreparedRow objects and splits them into training, validation, and test sets based on the specified ratios. 
    The splitting is done in a way that maintains the temporal order of the data, ensuring that earlier interactions are used for training and later interactions are reserved for validation and testing.

    Args:
        rows (list[PreparedRow]): the list of PreparedRow objects to split
        train_ratio (float): the proportion of data to allocate to the training set (between 0 and 1)
        validation_ratio (float): the proportion of data to allocate to the validation set (between 0 and 1, and less than 1 - train_ratio)
    Returns:
        tuple[list[PreparedRow], list[PreparedRow], list[PreparedRow]]: returns a tuple containing three lists of PreparedRow objects representing the training, validation, and test sets, respectively.
    """
    if not rows:
        return [], [], []
    
    total = len(rows)
    train_end = int(total * train_ratio)
    validation_end = train_end + int(total * validation_ratio)
    
    if train_end <= 0:
        train_end = 1
    if validation_end <= train_end and total - train_end > 1:
        validation_end = train_end + 1
    validation_end = min(validation_end, total)
    
    train = rows[:train_end]
    validation = rows[train_end:validation_end]
    test = rows[validation_end:]
    return train, validation, test

def _write_csv(path: Path, rows: list[PreparedRow]) -> None:
    """
    Writes a list of PreparedRow objects to a CSV file at the specified path. 
    The function ensures that the output CSV includes all relevant fields from the original rows, as well as the inferred label.

    Args:
        path (Path): the path to the CSV file to write
        rows (list[PreparedRow]): the list of PreparedRow objects to write to the CSV file
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        with path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["user_id", "game_id", "event_ts","liked","rating","label"])
        return
    
    fieldnames = list(rows[0].row.keys())
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for prepared in rows:
            writer.writerow(prepared.row)

def _file_sha256(path: Path) -> str:
    """
    Computes the SHA-256 hash of the file at the specified path. This can be used to generate a unique identifier for the file based on its contents, which is useful for versioning and ensuring data integrity.

    Args:
        path (Path): the path to the file for which to compute the hash
    Returns:
        str: returns the hexadecimal string representation of the SHA-256 hash of the file's contents.
    """
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()

def build_manifest(*, source_path: Path, train_rows: list[PreparedRow], validation_rows: list[PreparedRow], test_rows: list[PreparedRow], train_ratio: float, validation_ratio: float) -> dict[str, object]:
    """
    Builds a manifest dictionary containing metadata about the dataset, including the source file path, the number of rows in each split, and the SHA-256 hash of the source file. This manifest can be used for tracking dataset versions and ensuring reproducibility.

    Args:
        source_path (Path): the path to the original source CSV file from which the dataset was prepared
        train_rows (list[PreparedRow]): the list of PreparedRow objects in the training set
        validation_rows (list[PreparedRow]): the list of PreparedRow objects in the validation set
        test_rows (list[PreparedRow]): the list of PreparedRow objects in the test set
        train_ratio (float): the proportion of data allocated to the training set
        validation_ratio (float): the proportion of data allocated to the validation set
    Returns:
        dict[str, object]: returns a dictionary containing metadata about the dataset, including the source file path, row counts for each split, and the SHA-256 hash of the source file.
    """
    total = len(train_rows) + len(validation_rows) + len(test_rows)
    return {
        "splitter_version": SPLITTER_VERSION,
        "source_path": str(source_path),
        "source_sha256": _file_sha256(source_path),
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "split_strategy": "time_based",
        "split_ratios": {
            "train": train_ratio,
            "validation": validation_ratio,
            "test": max(0.0, 1.0 - train_ratio - validation_ratio),
        },
        "row_counts": {
            "total_labeled": total,
            "train": len(train_rows),
            "validation": len(validation_rows),
            "test": len(test_rows),
        },
        "boundaries": {
            "train_end_ts": train_rows[-1].timestamp.isoformat() if train_rows else None,
            "validation_end_ts": validation_rows[-1].timestamp.isoformat() if validation_rows else None,
        },
    }

def run_split(input_csv: Path, output_dir: Path, train_ratio: float = 0.8, validation_ratio: float = 0.1) -> dict[str, object]:
    """
    This function orchestrates the entire data preparation process. It reads the input CSV file, processes the rows to infer labels and timestamps, splits the data into training, validation, and test sets based on the specified ratios, writes the resulting splits to separate CSV files in the output directory, and generates a manifest file containing metadata about the dataset.

    Args:
        input_csv (Path): the path to the input CSV file containing raw interaction data
        output_dir (Path): the directory where the output CSV files and manifest should be saved
        train_ratio (float): the proportion of data to allocate to the training set (default is 0.8)
        validation_ratio (float): the proportion of data to allocate to the validation set (default is 0.1)
    Returns:
        dict[str, object]: returns a manifest dictionary containing metadata about the dataset preparation process, including the source file path, row counts for each split, and the SHA-256 hash of the source file. 
        The manifest can be used for tracking dataset versions and ensuring reproducibility.
    """
    rows = _read_row(input_csv)
    train_rows, validation_rows, test_rows = _split_row(rows, train_ratio=train_ratio, validation_ratio=validation_ratio)
    
    _write_csv(output_dir / "train.csv", train_rows)
    _write_csv(output_dir / "validation.csv", validation_rows)
    _write_csv(output_dir / "test.csv", test_rows)
    
    manifest = build_manifest(
        source_path=input_csv,
        train_rows=train_rows,
        validation_rows=validation_rows,
        test_rows=test_rows,
        train_ratio=train_ratio,
        validation_ratio=validation_ratio,
    )
    
    # Write the manifest to a JSON file in the output directory for record-keeping and reproducibility. This allows us to track the exact configuration and source data used for this dataset preparation, which is essential for debugging and future reference.
    with(output_dir / "manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    
    return manifest

def _parse_args() -> argparse.Namespace:
    """Parses command-line arguments for the data preparation script, allowing users to specify the input CSV file, output directory, and split ratios for training, validation, and test sets. The function returns an argparse.Namespace object containing the parsed arguments."""
    parser = argparse.ArgumentParser(description="Prepare training data by splitting raw interaction data into train/validation/test sets.")
    parser.add_argument("--input_csv", type=Path, required=True, help="Path to the input CSV file containing raw interaction data.")
    parser.add_argument("--output_dir", type=Path, required=True, help="Directory where the output CSV files and manifest should be saved.")
    parser.add_argument("--train_ratio", type=float, default=0.8, help="Proportion of data to allocate to the training set (default: 0.8).")
    parser.add_argument("--validation_ratio", type=float, default=0.1, help="Proportion of data to allocate to the validation set (default: 0.1).")
    return parser.parse_args()

def main() -> None:
    args = _parse_args()
    manifest = run_split(
        input_csv=args.input_csv,
        output_dir=args.output_dir,
        train_ratio=args.train_ratio,
        validation_ratio=args.validation_ratio,
    )
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    main()