# Section 3: Feature Pipeline Contract

This document defines the shared feature contract between training and inference for the recommender.

## Canonical feature schema

- **Schema version constant:** `FEATURE_SCHEMA_VERSION = "recommender_feature_schema_v1"`
- **Canonical feature order:**
  1. `liked_keyword_count`
  2. `liked_platform_count`
  3. `disliked_keyword_count`
  4. `disliked_platform_count`
- **Canonical vector type:** `list[float]`

Implementation source of truth:

- `services/recommender/models/feature_contract.py`

## Train and inference usage

### Inference path

- `ModelInputSchema` carries `feature_schema_version`.
- API payloads are normalized via `ModelInputSchema.from_recommend_request(...)`.
- Feature vectors are built via `build_feature_vector_from_payload(...)`.

Key files:

- `services/recommender/models/model_schema.py`
- `services/recommender/models/inference.py`
- `services/recommender/models/feature_contract.py`

### Training path

- Training rows are converted to the same canonical vector through
  `build_training_feature_vector(...)`, which delegates to
  `build_feature_vector_from_counts(...)` from the shared contract.

Key file:

- `services/recommender/training/feature_transform.py`

## Contract checks and parity tests

The following tests verify the contract:

- `services/recommender/tests/training/test_feature_pipeline_contract.py`
  - Asserts train/infer feature parity on the same logical input.
  - Asserts expected vector value and ordering.
- `services/recommender/tests/test_model_schema.py`
  - Asserts `feature_schema_version` default behavior.
  - Asserts explicit schema version propagation from request metadata.

## Acceptance status

Section 3 is considered **Pass** because:

- Shared train/infer transform module exists.
- Explicit schema versioning exists.
- Train-vs-infer parity test exists and passes.

## Keras implementation note

For Keras models, this contract is the preprocessing boundary used before calling
`model.predict(...)`. Any future schema change must:

1. bump `FEATURE_SCHEMA_VERSION`,
2. update training preprocessing and inference preprocessing together,
3. update parity tests and artifact metadata checks.
