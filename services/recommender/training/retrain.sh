#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${RECOMMENDER_PYTHON:-}" ]]; then
  PYTHON_BIN="${RECOMMENDER_PYTHON}"
elif [[ -x "${SCRIPT_DIR}/../ml-env/bin/python" ]]; then
  PYTHON_BIN="${SCRIPT_DIR}/../ml-env/bin/python"
elif [[ -x "${SCRIPT_DIR}/../ml-env/Scripts/python.exe" ]]; then
  PYTHON_BIN="${SCRIPT_DIR}/../ml-env/Scripts/python.exe"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "Error: python/python3 not found in PATH." >&2
  exit 1
fi

for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
    exec "$PYTHON_BIN" -m services.recommender.training.retrain "$@"
  fi
  if [[ "$arg" == "--input_csv" || "$arg" == --input_csv=* ]]; then
    exec "$PYTHON_BIN" -m services.recommender.training.retrain "$@"
  fi
done

if ! "$PYTHON_BIN" -c "import tensorflow" >/dev/null 2>&1; then
  echo "Error: tensorflow is not available in ${PYTHON_BIN}" >&2
  echo "Tip: use the project venv: services/recommender/ml-env/bin/python" >&2
  echo "Or set RECOMMENDER_PYTHON=/path/to/python-with-tensorflow" >&2
  exit 1
fi

SOURCE_CSV="${INPUT_SOURCE_CSV:-}"
if [[ -z "$SOURCE_CSV" ]]; then
  SOURCE_CSV="$(ls -t "${SCRIPT_DIR}"/user_interactions_*.csv 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$SOURCE_CSV" || ! -f "$SOURCE_CSV" ]]; then
  echo "Error: no source interactions CSV found." >&2
  echo "Provide --input_csv ... or set INPUT_SOURCE_CSV, or place user_interactions_*.csv in ${SCRIPT_DIR}" >&2
  exit 1
fi

INPUT_CSV="${SCRIPT_DIR}/input_interactions.csv"

"$PYTHON_BIN" - "$SOURCE_CSV" "$INPUT_CSV" <<'PY'
import csv
import sys
from datetime import datetime, timezone

source_path = sys.argv[1]
output_path = sys.argv[2]

TRUE_VALUES = {"true", "1", "yes"}
FALSE_VALUES = {"false", "0", "no"}

def normalize_ts(raw: str) -> str:
    value = (raw or "").strip().strip('"')
    if not value:
        raise ValueError("missing timestamp")

    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
        for fmt in ("%Y-%m-%d %H:%M:%S.%f %z", "%Y-%m-%d %H:%M:%S %z"):
            try:
                parsed = datetime.strptime(value, fmt)
                break
            except ValueError:
                continue
        if parsed is None:
            raise
        dt = parsed

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")

def normalize_liked(raw: str) -> str:
    value = (raw or "").strip().lower()
    if not value:
        return ""
    if value in TRUE_VALUES:
        return "true"
    if value in FALSE_VALUES:
        return "false"
    return ""

written = 0
with open(source_path, "r", encoding="utf-8", newline="") as src, open(
    output_path, "w", encoding="utf-8", newline=""
) as out:
    reader = csv.DictReader(src)
    writer = csv.DictWriter(
        out, fieldnames=["user_id", "game_id", "event_ts", "liked", "rating"]
    )
    writer.writeheader()

    for row in reader:
        user_id = (row.get("user_id") or "").strip()
        game_id = (row.get("game_id") or "").strip()
        ts_raw = row.get("event_ts") or row.get("timestamp") or ""
        if not user_id or not game_id:
            continue
        try:
            event_ts = normalize_ts(ts_raw)
        except ValueError:
            continue

        writer.writerow(
            {
                "user_id": user_id,
                "game_id": game_id,
                "event_ts": event_ts,
                "liked": normalize_liked(row.get("liked") or ""),
                "rating": (row.get("rating") or "").strip(),
            }
        )
        written += 1

print(f"Prepared {written} rows -> {output_path}")
PY

exec "$PYTHON_BIN" -m services.recommender.training.retrain --input_csv "$INPUT_CSV" "$@"
