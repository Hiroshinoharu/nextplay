# Section 8: Launch + Post-Training Validation

This document evaluates Section 8 from `PLAN.md` against the current repository implementation and test evidence.

## Acceptance criteria

Section 8 requires:

- a defined shadow/canary-style pre-production validation policy
- explicit promotion and rollback guardrails for rollout safety
- drift monitors across quality, distribution, and serving behavior
- retraining cadence and staleness limits

## Implementation evidence

Launch and post-training controls are implemented in:

- `services/recommender/training/launch_validation_policy.json`
  - `shadow_run` policy with:
    - `duration_hours`
    - `traffic_percent`
    - `promotion_gate` thresholds (CTR drop, Recall@20 drop, error rate, p95 latency)
    - `rollback_triggers` thresholds for error and latency regressions
  - `drift_monitors` policy with monitor types for:
    - `quality`
    - `distribution`
    - `serving`
  - monitor severities/actions and time windows
  - `retrain` policy with:
    - cadence (`schedule`, `incremental_check`)
    - staleness limit (`max_model_age_days`)
    - promotion/retrain controls

## Test evidence

Coverage exists in:

- `services/recommender/tests/training/test_launch_validation_policy.py::test_launch_validation_policy_has_required_sections`
  - verifies required top-level sections (`version`, `shadow_run`, `drift_monitors`, `retrain`)
- `services/recommender/tests/training/test_launch_validation_policy.py::test_shadow_run_policy_has_promotion_and_rollback_guards`
  - verifies rollout duration/traffic constraints and promotion/rollback threshold bounds
- `services/recommender/tests/training/test_launch_validation_policy.py::test_drift_monitors_cover_quality_distribution_and_serving`
  - verifies required monitor types and allowed severities/actions/windows
- `services/recommender/tests/training/test_launch_validation_policy.py::test_retrain_policy_defines_cadence_and_staleness_limits`
  - verifies cadence fields, staleness bounds, and governance booleans

Validation run for this section:

- `pytest -q services/recommender/tests/training/test_launch_validation_policy.py`

## Evaluation result

Section 8 is **Pass** (repo evidence + guardrail tests present).

Reason:

- launch validation policy is defined with explicit promotion and rollback thresholds
- drift coverage includes quality/distribution/serving controls
- retrain cadence and staleness controls are defined
- acceptance behavior is covered by dedicated tests
