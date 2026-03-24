# Make Troubleshooting (Recommender Retrain)

This note explains common `make` failures you saw during retraining.

## Error 2 (`make: *** ... Error 2`)

`Error 2` usually means a command failed due to usage/path/shell issues, not model quality.

Common causes:
- Invalid CLI flag or argument format
- Missing file/path (for example thresholds JSON path typo)
- Python/module execution issue
- Shell mismatch on Windows

Quick checks:
1. Run the exact Python command directly (without `make`) and read the first traceback/error line.
2. Verify paths exist:
   - `services/recommender/training/retrain.py`
   - thresholds file passed to `--thresholds_json`
3. Confirm Python env has required deps (TensorFlow, etc.).

## Error 3 (`make: *** ... Error 3`)

In this project, `Error 3` is typically a **gating failure** from retraining:
- training completed,
- but offline evaluation gate failed,
- so promotion to `artifacts/current` was blocked.

Example from your run:
- `status=offline_eval_failed`
- `min_coverage_at_k: observed=0.0067 required>=0.0500`

Where to inspect:
- `services/recommender/training/runs/<run_id>/run_log.json`
- `services/recommender/training/runs/<run_id>/gate_result.json`

## Recommended workflow

1. Run retrain target:
   - `make -f Makefile retrain-seeded-xl`
2. If it fails, inspect gate failures in `run_log.json`.
3. If gate passes and `--promote_current` is enabled, restart services:
   - `docker compose --env-file .env -f deploy/docker-compose.yml up -d --build recommender gateway`
4. Verify recommender startup logs show model loaded.

## Notes for large catalog runs

Large candidate spaces (e.g. tens of thousands of games) often reduce `coverage_at_k`.
Use a threshold profile appropriate for large catalogs:
- `services/recommender/training/offline_eval_thresholds_large_catalog.json`


