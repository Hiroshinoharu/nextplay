# Section 4: Model Artifact + Serving Compatibility

This document defines the runtime compatibility contract between trained recommender artifacts and serving startup.

## Artifact format

- Primary model artifact: `.keras`
- Sidecar metadata artifact: manifest JSON
- Candidate mapping artifact: JSON file referenced by manifest

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

## Acceptance status

Section 4 is **Pass** because:

- the artifact metadata contract exists and is validated at startup
- serving enforces model/manifest compatibility checks
- failure behavior is explicit and tested
