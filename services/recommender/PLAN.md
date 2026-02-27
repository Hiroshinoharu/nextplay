## Training Readiness Scorecard and Closure Plan (Repo-Only)

### Summary

Repo-only audit result for `services/recommender`:

- Overall: **No-go for full training rollout yet**
- Section score: **4 Pass / 1 Partial / 3 Missing**
- Blocking gaps: inference safety canary tests, experiment reproducibility

Current evidence was taken from:

- [TRAINING_READINESS_CHECKLIST.md](/Users/maxceban/Documents/nextplay/services/recommender/TRAINING_READINESS_CHECKLIST.md)
- [main.py](/Users/maxceban/Documents/nextplay/services/recommender/main.py)
- [inference.py](/Users/maxceban/Documents/nextplay/services/recommender/models/inference.py)
- [recommend.py](/Users/maxceban/Documents/nextplay/services/recommender/handlers/recommend.py)
- tests under [/Users/maxceban/Documents/nextplay/services/recommender/tests](/Users/maxceban/Documents/nextplay/services/recommender/tests)

### Scorecard (Checklist Sections)

| Section | Status | Repo-Only Evidence | Gap to Close |
|---|---|---|---|
| 1) Data + labels | Pass | Spec + splitter implementation + tests in [SECTION_1_DATA_LABEL_SPEC.md](/Users/maxceban/Documents/nextplay/services/recommender/training/SECTION_1_DATA_LABEL_SPEC.md), [data_prep.py](/Users/maxceban/Documents/nextplay/services/recommender/training/data_prep.py), [test_data_prep.py](/Users/maxceban/Documents/nextplay/services/recommender/tests/training/test_data_prep.py) | Keep schema stable as Keras training features are finalized |
| 2) Offline evaluation protocol | Pass | Protocol + evaluator + thresholds + gate tests in [SECTION_2_OFFLINE_EVAL_PROTOCOL.md](/Users/maxceban/Documents/nextplay/services/recommender/training/SECTION_2_OFFLINE_EVAL_PROTOCOL.md), [offline_eval.py](/Users/maxceban/Documents/nextplay/services/recommender/training/offline_eval.py), [offline_eval_thresholds.json](/Users/maxceban/Documents/nextplay/services/recommender/training/offline_eval_thresholds.json), [test_offline_eval.py](/Users/maxceban/Documents/nextplay/services/recommender/tests/training/test_offline_eval.py) | Calibrate thresholds once first Keras model baseline is frozen |
| 3) Feature pipeline contract | Pass | Shared feature contract + train/infer adapters + parity tests in [feature_contract.py](/Users/maxceban/Documents/nextplay/services/recommender/models/feature_contract.py), [feature_transform.py](/Users/maxceban/Documents/nextplay/services/recommender/training/feature_transform.py), [model_schema.py](/Users/maxceban/Documents/nextplay/services/recommender/models/model_schema.py), [test_feature_pipeline_contract.py](/Users/maxceban/Documents/nextplay/services/recommender/tests/training/test_feature_pipeline_contract.py), [test_model_schema.py](/Users/maxceban/Documents/nextplay/services/recommender/tests/test_model_schema.py) | Keep schema version aligned with artifact manifest once Section 4 lands |
| 4) Artifact + serving compatibility | Pass | Contract + acceptance doc in [SECTION_4_ARTIFACT_SERVING_COMPATIBILITY.md](/Users/maxceban/Documents/nextplay/services/recommender/training/SECTION_4_ARTIFACT_SERVING_COMPATIBILITY.md), startup/config validation in [main.py](/Users/maxceban/Documents/nextplay/services/recommender/main.py), manifest validator in [artifact_manifest.py](/Users/maxceban/Documents/nextplay/services/recommender/models/artifact_manifest.py), loader in [model_loader.py](/Users/maxceban/Documents/nextplay/services/recommender/models/model_loader.py), tests in [test_artifact_manifest.py](/Users/maxceban/Documents/nextplay/services/recommender/tests/test_artifact_manifest.py), [test_lifespan_model_loading.py](/Users/maxceban/Documents/nextplay/services/recommender/tests/test_lifespan_model_loading.py), [test_model_config.py](/Users/maxceban/Documents/nextplay/services/recommender/tests/test_model_config.py) | Maintain manifest compatibility checks in CI |
| 5) Inference correctness checks | Partial | Inference behavior tests in [test_inference_service.py](/Users/maxceban/Documents/nextplay/services/recommender/tests/test_inference_service.py) | Add golden train-vs-runtime parity test + NaN/Inf/empty-candidate canary |
| 6) Operational readiness | Pass | Fallback + latency/fallback metrics + model-version logs in [recommend.py](/Users/maxceban/Documents/nextplay/services/recommender/handlers/recommend.py) and [main.py](/Users/maxceban/Documents/nextplay/services/recommender/main.py) | Optional: add explicit error-rate metric counter |
| 7) Experiment tracking + reproducibility | Missing | No experiment tracker config or retrain entrypoint found | Add run logging (params/metrics/hash), fixed seeds, one-command retrain script |
| 8) Launch + post-training validation | Missing | No shadow/canary/drift process artifacts found | Define pre-prod shadow run, drift monitors, retrain cadence |

### Important Interface/Type Additions (Planned)

- `ModelInputSchema`: add `feature_schema_version: str`
- `ModelOutputSchema`: ensure `model_version: str` is carried in inference outputs/logs
- Add artifact manifest file (JSON): `model_version`, `feature_schema_version`, `candidate_index_map_path`, `training_config`, `random_seed`, `dataset_hash`
- Add shared transform contract module used by both training and inference (single source of truth)

### Implementation Plan (Decision-Complete)

1. Define training contract docs in recommender
   - Status: completed.
   - Create explicit task definition (top-N ranking), label window, leakage policy, and time-based split rules.
   - Acceptance: reproducible split spec with fixed dates/rules and dataset hash format.

2. Implement offline evaluator + baseline gates
   - Status: completed.
   - Add script(s) to compute Recall@K, NDCG@K, MAP@K, coverage/diversity.
   - Add baseline runner for popularity and current rule-based fallback.
   - Acceptance: thresholds committed and CI/local command returns pass/fail.

3. Unify feature transforms for train/infer
   - Status: completed.
   - Move feature extraction into shared module imported by runtime and training.
   - Add schema-version constant and validation.
   - Acceptance: same input yields identical transformed features in both contexts.

4. Harden artifact format and loading contract
   - Emit `.keras` plus manifest JSON and candidate mapping artifact.
   - Validate manifest on load before serving.
   - Acceptance: startup fails with clear error if manifest/schema mismatch occurs.

5. Add correctness and safety tests
   - Golden parity test: fixed request -> train preprocess == runtime preprocess.
   - Canary tests: NaN/Inf prediction handling and empty candidate output behavior.
   - Acceptance: tests fail on parity drift or unsafe outputs.

6. Add reproducibility + launch controls
   - Seed Python/NumPy/TensorFlow in train entrypoint.
   - Add one-command retrain script and run metadata logging.
   - Define shadow/canary rollout checklist and drift trigger thresholds.
   - Acceptance: same seed+data reproduces metrics within tolerance; rollout checklist executable.

### Test Cases and Scenarios

- Train/validation/test split determinism with fixed snapshot
- Metric computation regression tests on fixture dataset
- Baseline-vs-model comparison test enforcing thresholds
- Feature parity golden test (train path vs runtime path)
- Artifact manifest validation test (missing/mismatched fields)
- Inference canary tests for NaN/Inf and empty candidate list
- Startup behavior tests for required model + bad manifest + fallback mode

### Assumptions and Defaults

- Scope is **repo-only** (selected).
- Default task is **top-N ranking** for recommendation quality.
- Default split is **time-based**.
- Default artifact format is **`.keras` + manifest JSON**.
- Default go/no-go gate: do not start full training rollout until Sections 1, 2, 3, 5, and 7 are at least Partial-with-tests, and Section 4 is Pass.
