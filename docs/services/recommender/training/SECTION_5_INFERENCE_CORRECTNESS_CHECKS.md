# Section 5: Inference Correctness Checks

This document defines runtime correctness and safety checks for recommender inference behavior.

## Golden parity check

Goal: ensure training-time and runtime preprocessing remain aligned for the same logical input.

Coverage:

- `services/recommender/tests/test_inference_service.py::test_golden_train_vs_runtime_fewature_parity_for_inference_payload`

Validated behavior:

- Runtime features from `build_feature_vector_from_payload(...)` equal training features from `build_training_feature_vector(...)`.
- Expected canonical vector parity is asserted directly.

## Candidate mapping correctness (index -> game_id)

Runtime mapping behavior is explicit in:

- `services/recommender/models/inference.py`

Implementation detail:

- Candidate IDs are derived from model score index order via `enumerate(scores, start=1)`.

Coverage:

- `services/recommender/tests/test_inference_service.py::test_keras_inference_service_wraps_predict_call_and_ranks_results`

Validated behavior:

- Predict call receives expected feature payload shape.
- Ranked output order and resulting `game_id` values are asserted (`[2, 3, 1]` for fixture scores).

## Safety canary checks

Coverage:

- `services/recommender/tests/test_inference_service.py::test_keras_inference_service_filters_nan_inf_scores_canary`
- `services/recommender/tests/test_inference_service.py::test_keras_inference_service_empty_candidate_canary`

Validated behavior:

- NaN/Inf model outputs are filtered from candidates.
- Empty score lists return empty candidate outputs without failure.

## Acceptance status

Section 5 is **Pass** because:

- golden train-vs-runtime parity test exists and passes
- candidate index-to-ID mapping is explicit and tested
- NaN/Inf and empty-candidate canary checks exist and pass
