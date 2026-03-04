import json
from pathlib import Path

def _load_policy() -> dict:
    """
    Load the launch validation policy from the file system.

    Returns:
        dict: The launch validation policy as a dictionary.
    """
    repo_root = Path(__file__).resolve().parents[4]
    policy_path = repo_root / "services" / "recommender" / "training" / "launch_validation_policy.json"
    return json.loads(policy_path.read_text(encoding="utf-8"))

def test_launch_validation_policy_has_required_sections() -> None:
    """
    Verify that the launch validation policy has the required sections.

    The required sections are "version", "shadow_run", "drift_monitors", and "retrain".
    """
    launch_validation_policy = _load_policy()
    
    required_sections = {"version", "shadow_run", "drift_monitors", "retrain"}
    assert set(launch_validation_policy.keys()) >= required_sections

def test_shadow_run_policy_has_promotion_and_rollback_guards() -> None:
    """
    Verify that the shadow run policy has promotion and rollback guards set.

    The promotion gate sets the conditions for promoting the model to the
    main traffic path. The rollback triggers set the conditions for rolling
    back the model to a shadow traffic path.

    The promotion gate must have the following conditions set:
        - The model must be running for at least 24 hours.
        - At least 1% of traffic must be routed to the shadow traffic path.
        - The relative change in CTR must be less than or equal to 0.1.
        - The relative change in recall at 20 must be less than or equal to 0.1.
        - The error rate must be less than or equal to 0.05.
        - The p95 latency must be less than or equal to 250 milliseconds.

    The rollback triggers must have the following conditions set:
        - The error rate must be greater than the maximum error rate set in the
          promotion gate.
        - The p95 latency must be greater than the maximum p95 latency set in the
          promotion gate.
    """
    launch_validation_policy = _load_policy()
    
    shadow_run_policy = launch_validation_policy["shadow_run"]
    
    assert shadow_run_policy["duration_hours"] >= 24
    assert 0 < shadow_run_policy["traffic_percent"] <= 100
    
    gate = shadow_run_policy["promotion_gate"]
    assert 0 <= gate["max_relative_ctr_drop"] <= 0.1
    assert 0 <= gate["max_relative_recall_at_20_drop"] <= 0.1
    assert 0 < gate["max_error_rate"] <= 0.05
    assert gate["max_p95_latency_ms"] <= 250
    
    rollback = shadow_run_policy["rollback_triggers"]
    assert rollback["error_rate"] > gate["max_error_rate"]
    assert rollback["p95_latency_ms"] > gate["max_p95_latency_ms"]

def test_drift_monitors_cover_quality_distribution_and_serving() -> None:
    """
    Verify that the drift monitors in the launch validation policy cover quality,
    distribution, and serving, and that they have the correct severity and
    actions.

    The drift monitors should be set to monitor the following types:
        - quality
        - distribution
        - serving

    The severity and actions for the drift monitors should be set to the
    following values:
        - severity: "low", "medium", "high"
        - actions: "trigger_retrain", "open_investigation", "fallback_only"
    """
    launch_validation_policy = _load_policy()
    drift_monitors = launch_validation_policy["drift_monitors"]
    
    assert drift_monitors, "drift monitors list should not be empty"
    
    types = {monitor["type"] for monitor in drift_monitors}
    assert {"quality", "distribution", "serving"}.issubset(types)

    allowed_severity = {"low", "medium", "high"}
    allowed_actions = {"trigger_retrain", "open_investigation", "fallback_only"}

    for monitor in drift_monitors:
        assert monitor["window"] in {"6h", "24h", "7d"}
        assert monitor["severity"] in allowed_severity
        assert monitor["action"] in allowed_actions

def test_retrain_policy_defines_cadence_and_staleness_limits() -> None:
    """
    Verify that the retrain policy defines the correct cadence and staleness limits.

    The retrain policy should define the following fields:
        - schedule: the cadence of retraining; can be weekly or biweekly
        - full_retrain_day: the day of the week when a full retrain is triggered
        - incremental_check: the cadence of incremental retraining; can be daily or hourly
        - max_model_age_days: the maximum age of a model in days before it is retrained
        - auto_retrain_on_high_severity_drift: whether to automatically retrain on high severity drift
        - manual_review_required_for_promotion: whether manual review is required before promoting a model

    """
    launch_validation_policy = _load_policy()
    retrain = launch_validation_policy["retrain"]

    # Check that the retrain policy defines the correct schedule
    assert retrain["schedule"] in {"weekly", "biweekly"}

    # Check that the retrain policy defines a full retrain day
    assert retrain["full_retrain_day"]

    # Check that the retrain policy defines the correct incremental check cadence
    assert retrain["incremental_check"] in {"daily", "hourly"}

    # Check that the retrain policy defines the correct staleness limits
    assert 1 <= retrain["max_model_age_days"] <= 30

    # Check that the retrain policy defines whether to automatically retrain on high severity drift
    assert isinstance(retrain["auto_retrain_on_high_severity_drift"], bool)

    # Check that the retrain policy defines whether manual review is required before promoting a model
    assert isinstance(retrain["manual_review_required_for_promotion"], bool)
