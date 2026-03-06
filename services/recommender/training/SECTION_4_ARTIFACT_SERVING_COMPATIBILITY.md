# Section 4: Model Artifact + Serving Compatibility

This document defines the runtime compatibility contract between trained recommender artifacts and serving startup.

## Artifact format

- Primary model artifact: `.keras`
- Sidecar metadata artifact: manifest JSON
- Candidate mapping artifact: JSON file referenced by manifest

Training promotion now writes a versioned artifact bundle per run at:

- `services/recommender/training/runs/<run_id>/artifacts/<artifact_version>/`

Bundle paths recorded in `run_log.json`:

- `model_path`: `<bundle>/recommender_<artifact_version>.keras` (reserved path when trainer is stubbed)
- `manifest_path`: `<bundle>/artifact_manifest.json`
- `candidate_index_map_path`: `<bundle>/candidate_index_map.json`

## Manifest contract

The serving manifest schema is defined by `ArtifactManifest` in:

- `services/recommender/models/artifact_manifest.py`

Required serving metadata fields:

- `model_version`
- `feature_schema_version`
- `candidate_index_map_path`

Tracked reproducibility fields:

- `training_config`
- `random_seed`
- `dataset_hash`

## Startup loading contract

Runtime startup behavior is defined in:

- `services/recommender/main.py`

Environment-driven controls:

- `MODEL_PATH`
- `MODEL_VERSION`
- `MODEL_REQUIRED`
- `MODEL_MANIFEST_PATH` (optional explicit manifest override)

Startup flow:

1. Build model config from env vars.
2. Validate model path/required semantics.
3. Resolve and validate manifest (including schema and model-version checks).
4. Load model if path is present.
5. Expose `app.state.model_manifest`, `app.state.model`, and inference services.

## Promotion contract (post-offline-eval)

Retraining promotion is gated entirely by `metrics.passed`:

1. Retrain always writes the versioned artifact bundle directory and manifest/candidate map files.
2. Promotion is **allowed only** when `metrics.passed == true`.
3. Promotion metadata is persisted in `run_log.json` under `promotion` with:
   - `artifact_version`
   - `bundle_dir`
   - `model_path`
   - `manifest_path`
   - `candidate_index_map_path`
   - `promoted` (bool)
   - `status` (`promoted` or `blocked_offline_thresholds`)
   - `promoted_at` (UTC timestamp when promoted; `null` when blocked)
4. CLI exit behavior remains aligned to this gate: retrain exits non-zero when offline eval fails.

## Validation and fail behavior

Manifest loading/validation is implemented in:

- `services/recommender/models/artifact_manifest.py`

Validation checks:

- manifest file exists
- `feature_schema_version` matches shared contract version
- `model_version` matches expected runtime model version
- `candidate_index_map_path` resolves and exists
- `MODEL_PATH` exists when provided

Failure mode:

- startup raises clear `RuntimeError` for contract mismatches or missing artifact paths

## Test coverage

Section 4 coverage is provided by:

- `services/recommender/tests/test_model_config.py`
  - env defaults
  - required path enforcement
  - missing/valid model path behavior
  - manifest path resolution
- `services/recommender/tests/test_artifact_manifest.py`
  - happy path load
  - schema mismatch failure
  - missing candidate map failure
- `services/recommender/tests/test_lifespan_model_loading.py`
  - startup state when model is loaded
  - startup state when model path is not configured
- `services/recommender/tests/training/test_retrain.py`
  - writes artifact bundle contract paths into `run_log.json`
  - records promotion metadata when offline gates pass
  - blocks promotion and records blocked status/timestamp when offline gates fail

## Acceptance status

Section 4 is **Pass** because:

- the artifact metadata contract exists and is validated at startup
- serving enforces model/manifest compatibility checks
- failure behavior is explicit and tested
