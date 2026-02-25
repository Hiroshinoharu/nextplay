# Recommender Model Training Readiness Checklist

Use this before training a Keras model for the recommender service.

## 1) Data + labels

- Define the target task clearly (e.g., top-N ranking vs. binary click/like prediction).
- Confirm the label window and leakage boundaries (train only on data available at prediction time).
- Add a stable train/validation/test split strategy (prefer time-based split for recommendation).
- Log dataset version/hash and feature extraction code version.

## 2) Offline evaluation protocol

- Choose ranking metrics that match product goals: `Recall@K`, `NDCG@K`, `MAP@K`, coverage/diversity.
- Add a simple baseline comparison (popularity baseline + your current rule-based fallback).
- Set explicit acceptance thresholds before training.

## 3) Feature pipeline contract

- Keep one source of truth for feature transforms used in both training and inference.
- Add a schema/version for model input tensors so training output and runtime input stay compatible.
- Ensure unknown/missing values are handled consistently.

## 4) Model artifact + serving compatibility

- Save artifacts in a reproducible format (`.keras` or SavedModel) with versioned metadata.
- Record:
  - model version
  - feature schema version
  - candidate ID mapping/index file
  - training config and random seed
- Validate startup loading path and fail behavior using env vars (`MODEL_PATH`, `MODEL_VERSION`, `MODEL_REQUIRED`).

## 5) Inference correctness checks

- Add a golden test that runs one fixed request through training-time preprocessing and runtime inference and compares outputs.
- Verify candidate ID mapping (index -> game_id) is explicit and tested.
- Add a canary check for NaN/Inf outputs and empty candidate lists.

## 6) Operational readiness

- Add latency/error metrics and fallback-rate tracking for recommender endpoints.
- Add model-version logging in request handling for observability.
- Define rollback strategy to fallback/rule-based inference when model load or prediction fails.

## 7) Experiment tracking + reproducibility

- Track experiments (params, metrics, dataset versions, model hash).
- Fix random seeds for Python/NumPy/TensorFlow where deterministic behavior is needed.
- Keep a small script for one-command retraining with pinned dependencies.

## 8) Launch and post-training validation

- Run shadow/canary validation before full rollout.
- Monitor quality drift (metric degradation, popularity collapse, cold-start failure rate).
- Schedule retraining cadence and drift alerts.

---

## Notes for this repository

- There is already a model-loading configuration path in `services/recommender/main.py` and a rule-based fallback in `services/recommender/models/inference.py`.
- Existing tests cover config validation, schema mapping, and inference service behavior; add training-time parity tests next.
