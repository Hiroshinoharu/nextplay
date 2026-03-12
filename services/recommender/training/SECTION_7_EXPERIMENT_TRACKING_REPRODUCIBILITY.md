# Section 7: Experiment Tracking + Reproducibility

This document evaluates Section 7 from `PLAN.md` against the current repository implementation and test evidence.

## Acceptance criteria

Section 7 requires:

- fixed seeding for reproducibility
- one-command retrain entrypoint
- run metadata logging for params, metrics, and hashes
- reproducible outputs for same seed + data
- deterministic dataset assembly and pre-train quality gates

## Golden path commands

### Local gate run (seeded + DB export)

```bash
python -m services.recommender.training.retrain \
  --source_mode seeded_plus_db \
  --db_export_csv services/recommender/training/input_interactions.csv \
  --run_id local_gate \
  --epochs 8 \
  --batch_size 16 \
  --k 10
```

### CI-style smoke gate (seeded only)

```bash
python -m services.recommender.training.retrain \
  --source_mode seeded_only \
  --run_id ci_gate \
  --epochs 1 \
  --batch_size 16 \
  --k 10
```

### Promote current artifacts only after pass

```bash
python -m services.recommender.training.retrain \
  --source_mode seeded_plus_db \
  --db_export_csv services/recommender/training/input_interactions.csv \
  --run_id promote_ready \
  --promote_current
```

`artifacts/current` is updated only when all gates pass and `--promote_current` is set.

## Expected artifacts per run

Each run under `services/recommender/training/runs/<run_id>/` must include:

- `run_log.json`
- `dataset_profile.json`
- `gate_result.json`
- `prepared/train.csv`, `prepared/validation.csv`, `prepared/test.csv`
- `predictions/predictions.csv` when dataset quality passes
- `artifacts/<run_id>/artifact_manifest.json`
- `artifacts/<run_id>/candidate_index_map.json`
- `artifacts/<run_id>/recommender_<run_id>.keras`

## Failure triage

- Exit code `2` (`dataset_quality_failed`): dataset did not meet quality thresholds before training.
  - Check `dataset_profile.json` -> `quality_failures`.
  - Typical fixes: increase data volume, user/item coverage, negatives, or adjust source mode.
- Exit code `3` (`offline_eval_failed`): model gate failed after training/evaluation.
  - Check `gate_result.json` -> `gate_failures` and `run_log.json` -> `metrics`.
  - Typical fixes: improve interaction signal quality, model fit, or data representativeness.

## Implementation evidence

Reproducibility and gate controls are implemented in:

- `services/recommender/training/retrain.py`
  - deterministic seeding (`set_global_seed`)
  - deterministic source assembly (`seeded_only`, `db_only`, `seeded_plus_db`)
  - run metadata and hash tracking
  - explicit dataset quality and offline gate outcomes
- `services/recommender/training/dataset_pipeline.py`
  - seeded interaction generation
  - DB/export ingestion + merge
  - dataset profile + quality checks

## Test evidence

Coverage exists in:

- `services/recommender/tests/training/test_retrain.py`
- `services/recommender/tests/training/test_offline_eval.py`
- `services/recommender/tests/training/test_dataset_pipeline.py`

## Evaluation result

Section 7 remains **Pass**, with stronger reproducibility, deterministic dataset assembly, and machine-readable gate artifacts.
