from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


INTERACTION_FIELDNAMES = ["user_id", "game_id", "event_ts", "liked", "rating"]


@dataclass(frozen=True)
class DatasetQualityConfig:
    min_rows: int = 60
    min_unique_users: int = 8
    min_unique_games: int = 20
    min_positive_rows: int = 20
    min_negative_rows: int = 20
    min_users_with_positive: int = 6
    min_interactions_per_user: int = 4
    min_train_rows: int = 30
    min_validation_rows: int = 5
    min_test_rows: int = 5
    min_positive_ratio: float = 0.15
    max_positive_ratio: float = 0.85


def _parse_event_ts(raw: str) -> datetime:
    value = (raw or "").strip()
    if not value:
        raise ValueError("missing event_ts")
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _normalize_row(row: dict[str, str]) -> dict[str, str] | None:
    user_id = (row.get("user_id") or "").strip()
    game_id = (row.get("game_id") or "").strip()
    event_ts_raw = (
        row.get("event_ts")
        or row.get("timestamp")
        or row.get("created_at")
        or ""
    )
    if not user_id or not game_id:
        return None

    try:
        event_ts = _parse_event_ts(event_ts_raw).isoformat().replace("+00:00", "Z")
    except ValueError:
        return None

    liked_raw = (row.get("liked") or "").strip().lower()
    rating_raw = (row.get("rating") or "").strip()
    label_raw = (row.get("label") or "").strip()

    if liked_raw in {"true", "1", "yes"}:
        liked = "true"
    elif liked_raw in {"false", "0", "no"}:
        liked = "false"
    elif label_raw == "1":
        liked = "true"
    elif label_raw == "0":
        liked = "false"
    else:
        liked = ""

    return {
        "user_id": user_id,
        "game_id": game_id,
        "event_ts": event_ts,
        "liked": liked,
        "rating": rating_raw,
    }


def load_interactions_from_csv(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            normalized = _normalize_row(row)
            if normalized is not None:
                rows.append(normalized)
    return rows


def generate_seeded_interactions(
    *,
    seed: int,
    users: int,
    games: int,
    history_per_user: int,
    holdout_per_user: int,
) -> list[dict[str, str]]:
    if users < 4:
        raise ValueError("seeded dataset requires at least 4 users")
    if games < 20:
        raise ValueError("seeded dataset requires at least 20 games")
    if history_per_user < 2:
        raise ValueError("seed_history_per_user must be >= 2")
    if holdout_per_user < 1:
        raise ValueError("seed_holdout_per_user must be >= 1")

    user_ids = [str(1000 + idx) for idx in range(1, users + 1)]
    game_ids = [str(5000 + idx) for idx in range(1, games + 1)]

    target_pool_size = min(8, max(4, games // 8))
    target_pool = game_ids[:target_pool_size]
    holdout_targets = {
        user_id: target_pool[(idx + seed) % len(target_pool)]
        for idx, user_id in enumerate(user_ids)
    }

    timestamp = datetime(2025, 1, 1, tzinfo=timezone.utc)
    all_rows: list[dict[str, str]] = []
    seen_pairs: set[tuple[str, str]] = set()

    def add_row(*, user_id: str, game_id: str, liked: str) -> None:
        nonlocal timestamp
        if (user_id, game_id) in seen_pairs:
            return
        seen_pairs.add((user_id, game_id))
        all_rows.append(
            {
                "user_id": user_id,
                "game_id": game_id,
                "event_ts": timestamp.isoformat().replace("+00:00", "Z"),
                "liked": liked,
                "rating": "",
            }
        )
        timestamp += timedelta(minutes=1)

    for idx, user_id in enumerate(user_ids):
        holdout_target = holdout_targets[user_id]

        for target_game in target_pool:
            if target_game == holdout_target:
                continue
            add_row(user_id=user_id, game_id=target_game, liked="true")

        cursor = target_pool_size + ((idx * 5 + seed) % max(1, games - target_pool_size))
        added = 0
        while added < history_per_user:
            game_id = game_ids[cursor % len(game_ids)]
            cursor += 1
            if game_id in target_pool:
                continue
            liked = "false" if added % 2 == 0 else "true"
            add_row(user_id=user_id, game_id=game_id, liked=liked)
            added += 1

    for user_id in user_ids:
        primary_target = holdout_targets[user_id]
        add_row(user_id=user_id, game_id=primary_target, liked="true")

        for offset in range(1, holdout_per_user):
            alt_target = target_pool[(target_pool.index(primary_target) + offset) % len(target_pool)]
            if alt_target == primary_target:
                continue
            add_row(user_id=user_id, game_id=alt_target, liked="true")

    return all_rows

def merge_interaction_rows(
    *,
    seeded_rows: list[dict[str, str]],
    external_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    deduped: dict[tuple[str, str, str, str, str], dict[str, str]] = {}
    for row in [*seeded_rows, *external_rows]:
        key = (
            row["user_id"],
            row["game_id"],
            row["event_ts"],
            row.get("liked", ""),
            row.get("rating", ""),
        )
        deduped[key] = row

    merged = list(deduped.values())
    merged.sort(key=lambda row: _parse_event_ts(row["event_ts"]))
    return merged


def write_interactions_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=INTERACTION_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def _collect_labeled_rows(*paths: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for path in paths:
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
    return rows


def build_dataset_profile(
    *,
    train_csv: Path,
    validation_csv: Path,
    test_csv: Path,
) -> dict[str, Any]:
    all_rows = _collect_labeled_rows(train_csv, validation_csv, test_csv)
    train_rows = _collect_labeled_rows(train_csv)
    validation_rows = _collect_labeled_rows(validation_csv)
    test_rows = _collect_labeled_rows(test_csv)

    user_counts: dict[str, int] = {}
    users_with_positive: set[str] = set()
    unique_games: set[str] = set()
    positives = 0
    negatives = 0

    for row in all_rows:
        user_id = (row.get("user_id") or "").strip()
        game_id = (row.get("game_id") or "").strip()
        label = (row.get("label") or "").strip()
        if not user_id or not game_id:
            continue
        user_counts[user_id] = user_counts.get(user_id, 0) + 1
        unique_games.add(game_id)
        if label == "1":
            positives += 1
            users_with_positive.add(user_id)
        elif label == "0":
            negatives += 1

    total = positives + negatives
    positive_ratio = float(positives / total) if total else 0.0
    min_interactions_per_user = min(user_counts.values()) if user_counts else 0

    return {
        "total_labeled_rows": total,
        "split_rows": {
            "train": len(train_rows),
            "validation": len(validation_rows),
            "test": len(test_rows),
        },
        "unique_users": len(user_counts),
        "unique_games": len(unique_games),
        "users_with_positive": len(users_with_positive),
        "positive_rows": positives,
        "negative_rows": negatives,
        "positive_ratio": positive_ratio,
        "min_interactions_per_user": min_interactions_per_user,
    }


def evaluate_dataset_quality(
    *,
    profile: dict[str, Any],
    config: DatasetQualityConfig,
) -> list[str]:
    failures: list[str] = []
    checks: list[tuple[str, float, float]] = [
        ("min_rows", float(profile.get("total_labeled_rows", 0)), float(config.min_rows)),
        (
            "min_unique_users",
            float(profile.get("unique_users", 0)),
            float(config.min_unique_users),
        ),
        (
            "min_unique_games",
            float(profile.get("unique_games", 0)),
            float(config.min_unique_games),
        ),
        (
            "min_positive_rows",
            float(profile.get("positive_rows", 0)),
            float(config.min_positive_rows),
        ),
        (
            "min_negative_rows",
            float(profile.get("negative_rows", 0)),
            float(config.min_negative_rows),
        ),
        (
            "min_users_with_positive",
            float(profile.get("users_with_positive", 0)),
            float(config.min_users_with_positive),
        ),
        (
            "min_interactions_per_user",
            float(profile.get("min_interactions_per_user", 0)),
            float(config.min_interactions_per_user),
        ),
        (
            "min_train_rows",
            float((profile.get("split_rows") or {}).get("train", 0)),
            float(config.min_train_rows),
        ),
        (
            "min_validation_rows",
            float((profile.get("split_rows") or {}).get("validation", 0)),
            float(config.min_validation_rows),
        ),
        (
            "min_test_rows",
            float((profile.get("split_rows") or {}).get("test", 0)),
            float(config.min_test_rows),
        ),
    ]
    for name, observed, required in checks:
        if observed < required:
            failures.append(f"{name}: observed={observed:.0f} required>={required:.0f}")

    ratio = float(profile.get("positive_ratio", 0.0))
    if ratio < config.min_positive_ratio:
        failures.append(
            f"min_positive_ratio: observed={ratio:.4f} required>={config.min_positive_ratio:.4f}"
        )
    if ratio > config.max_positive_ratio:
        failures.append(
            f"max_positive_ratio: observed={ratio:.4f} required<={config.max_positive_ratio:.4f}"
        )

    return failures

