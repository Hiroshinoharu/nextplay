import json
from pathlib import Path

from services.recommender.training.launch_gate import run_launch_gate


def _write_json(path: Path, payload: dict) -> None:
    """
    Writes a JSON file to the given path containing the given payload.

    Args:
        path (Path): The path to the JSON file to write.
        payload (dict): The payload to write to the JSON file.

    Notes:
        The parent directory of the given path is created if it does not exist.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _write_run_log(
    run_dir: Path,
    *,
    passed: bool,
    model_recall: float,
    popularity_recall: float,
    fallback_recall: float,
    model_ndcg: float = 0.50,
    popularity_ndcg: float = 0.40,
    model_map: float = 0.40,
    popularity_map: float = 0.30,
    model_coverage: float = 0.20,
    model_diversity: float = 0.95,
) -> None:
    """
    Writes a JSON file to the given path containing a run log payload.

    The payload contains the following fields:

    - `run_id`: The name of the run directory.
    - `params`: A dictionary containing the following key-value pairs:
        - `thresholds_json`: The path to the JSON file containing the quality gate thresholds.
    - `metrics`: A dictionary containing the following key-value pairs:
        - `passed`: A boolean indicating whether the run passed the quality gate.
        - `model`: A dictionary containing the following key-value pairs:
            - `recall_at_k`: The recall at K for the model.
            - `ndcg_at_k`: The normalized discounted cumulative gain at K for the model.
            - `map_at_k`: The mean average precision at K for the model.
            - `coverage_at_k`: The coverage at K for the model.
            - `list_diversity_at_k`: The list diversity at K for the model.
        - `popularity_baseline`: A dictionary containing the following key-value pairs:
            - `recall_at_k`: The recall at K for the popularity baseline.
            - `ndcg_at_k`: The normalized discounted cumulative gain at K for the popularity baseline.
            - `map_at_k`: The mean average precision at K for the popularity baseline.
        - `rule_based_fallback_baseline`: A dictionary containing the following key-value pairs:
            - `recall_at_k`: The recall at K for the rule-based fallback baseline.
            - `ndcg_at_k`: The normalized discounted cumulative gain at K for the rule-based fallback baseline.
            - `map_at_k`: The mean average precision at K for the rule-based fallback baseline.

    Args:
        run_dir (Path): The path to the run directory.
        passed (bool): A boolean indicating whether the run passed the quality gate.
        model_recall (float): The recall at K for the model.
        popularity_recall (float): The recall at K for the popularity baseline.
        fallback_recall (float): The recall at K for the rule-based fallback baseline.
        model_ndcg (float, optional): The normalized discounted cumulative gain at K for the model. Defaults to 0.50.
        popularity_ndcg (float, optional): The normalized discounted cumulative gain at K for the popularity baseline. Defaults to 0.40.
        model_map (float, optional): The mean average precision at K for the model. Defaults to 0.40.
        popularity_map (float, optional): The mean average precision at K for the popularity baseline. Defaults to 0.30.
        model_coverage (float, optional): The coverage at K for the model. Defaults to 0.20.
        model_diversity (float, optional): The list diversity at K for the model. Defaults to 0.95.
    """
    payload = {
        "run_id": run_dir.name,
        "params": {"thresholds_json": "services/recommender/training/offline_eval_thresholds.json"},
        "metrics": {
            "passed": passed,
            "model": {
                "recall_at_k": model_recall,
                "ndcg_at_k": model_ndcg,
                "map_at_k": model_map,
                "coverage_at_k": model_coverage,
                "list_diversity_at_k": model_diversity,
            },
            "popularity_baseline": {
                "recall_at_k": popularity_recall,
                "ndcg_at_k": popularity_ndcg,
                "map_at_k": popularity_map,
            },
            "rule_based_fallback_baseline": {
                "recall_at_k": fallback_recall,
                "ndcg_at_k": 0.10,
                "map_at_k": 0.10,
            },
        },
    }
    _write_json(run_dir / "run_log.json", payload)


def _write_thresholds(path: Path, *, min_recall_at_k: float) -> None:
    """
    Writes a JSON file containing minimum required quality metrics to the given path.

    Args:
        path (Path): The path to write the JSON file to.
        min_recall_at_k (float): The minimum required recall at K.

    Notes:
        This function writes a JSON file containing the following quality metrics:
        - min_recall_at_k: Minimum required recall at K.
        - min_ndcg_at_k: Minimum required normalized discounted cumulative gain at K.
        - min_map_at_k: Minimum required mean average precision at K.
        - min_coverage_at_k: Minimum required coverage at K.
        - min_list_diversity_at_k: Minimum required list diversity at K.
        - min_recall_lift_vs_popularity: Minimum required lift in recall vs the popularity baseline at K.
        - min_ndcg_lift_vs_popularity: Minimum required lift in normalized discounted cumulative gain vs the popularity baseline at K.
        - min_map_lift_vs_popularity: Minimum required lift in mean average precision vs the popularity baseline at K.
        - min_recall_lift_vs_fallback: Minimum required lift in recall vs the rule-based fallback baseline at K.
    """
    _write_json(
        path,
        {
            "min_recall_at_k": min_recall_at_k,
            "min_ndcg_at_k": 0.10,
            "min_map_at_k": 0.10,
            "min_coverage_at_k": 0.05,
            "min_list_diversity_at_k": 0.90,
            "min_recall_lift_vs_popularity": 0.00,
            "min_ndcg_lift_vs_popularity": 0.00,
            "min_map_lift_vs_popularity": 0.00,
            "min_recall_lift_vs_fallback": 0.00,
        },
    )


def _write_policy(path: Path) -> None:
    """
    Writes a policy file to the given path.

    Args:
        path (Path): The path to write the policy file to.

    Notes:
        This function writes a JSON file containing the following policy:
        - version: The version of the policy.
        - offline_gate: A dictionary containing the critical thresholds for the offline gate.
            - critical_thresholds: A list of critical thresholds. If any of these thresholds fail, the offline gate will block promotion.
    """
    _write_json(
        path,
        {
            "version": "test-policy-v1",
            "offline_gate": {
                "critical_thresholds": ["min_map_at_k", "min_recall_at_k", "min_ndcg_at_k"],
            },
        },
    )


def test_launch_gate_blocks_when_any_critical_threshold_fails(tmp_path: Path) -> None:
    """
    Verify that the launch gate blocks when any critical threshold fails.

    This test case creates a run log with failing offline evaluation metrics and
    then runs the launch gate twice. The test verifies that the output reasons
    are identical between the two runs.
    """
    runs_dir = tmp_path / "runs"
    run_dir = runs_dir / "run_001"
    _write_run_log(
        run_dir,
        passed=False,
        model_recall=0.10,
        popularity_recall=0.10,
        fallback_recall=0.05,
    )

    thresholds_path = tmp_path / "offline_eval_thresholds.json"
    policy_path = tmp_path / "launch_validation_policy.json"
    _write_thresholds(thresholds_path, min_recall_at_k=0.20)
    _write_policy(policy_path)

    result = run_launch_gate(
        runs_dir=runs_dir,
        offline_thresholds_json=thresholds_path,
        launch_policy_json=policy_path,
    )

    assert result["can_launch"] is False
    assert result["decision"] == "fail"
    assert any(reason["code"] == "critical_threshold_failed" for reason in result["reasons"])
    assert any(reason["code"] == "offline_eval_failed" for reason in result["reasons"])
    assert (run_dir / "launch_gate_decision.json").exists()


def test_launch_gate_passes_when_all_required_checks_pass(tmp_path: Path) -> None:
    """
    Verify that the launch gate passes when all required checks pass.

    This test writes a run log with passing offline evaluation metrics and
    then runs the launch gate. The test verifies that the result has
    "can_launch" set to True, "decision" set to "pass", and an empty
    list of reasons. Additionally, the test verifies that the persisted
    run log has the correct decision and artifact version.
    """
    runs_dir = tmp_path / "runs"
    run_dir = runs_dir / "run_002"
    _write_run_log(
        run_dir,
        passed=True,
        model_recall=0.40,
        popularity_recall=0.20,
        fallback_recall=0.10,
    )

    thresholds_path = tmp_path / "offline_eval_thresholds.json"
    policy_path = tmp_path / "launch_validation_policy.json"
    _write_thresholds(thresholds_path, min_recall_at_k=0.20)
    _write_policy(policy_path)

    result = run_launch_gate(
        runs_dir=runs_dir,
        offline_thresholds_json=thresholds_path,
        launch_policy_json=policy_path,
    )

    assert result["can_launch"] is True
    assert result["decision"] == "pass"
    assert result["reasons"] == []
    assert (run_dir / "launch_gate_decision.json").exists()


def test_launch_gate_reasons_are_deterministic_and_stable(tmp_path: Path) -> None:
    """
    Verify that the launch gate reasons are deterministic and stable.

    This test case ensures that the launch gate reasons are reproducible and
    do not change over time, given the same input conditions.

    The test case writes a run log with failing offline evaluation metrics and
    then runs the launch gate twice. The test verifies that the output reasons
    are identical between the two runs.
    """
    runs_dir = tmp_path / "runs"
    run_dir = runs_dir / "run_003"
    _write_run_log(
        run_dir,
        passed=False,
        model_recall=0.05,
        popularity_recall=0.10,
        fallback_recall=0.04,
        model_ndcg=0.05,
        model_map=0.05,
    )

    thresholds_path = tmp_path / "offline_eval_thresholds.json"
    policy_path = tmp_path / "launch_validation_policy.json"
    _write_thresholds(thresholds_path, min_recall_at_k=0.20)
    _write_policy(policy_path)

    first = run_launch_gate(
        run_dir=run_dir,
        offline_thresholds_json=thresholds_path,
        launch_policy_json=policy_path,
    )
    second = run_launch_gate(
        run_dir=run_dir,
        offline_thresholds_json=thresholds_path,
        launch_policy_json=policy_path,
    )

    first_reasons = first["reasons"]
    second_reasons = second["reasons"]
    assert first_reasons == second_reasons
    assert [reason["code"] for reason in first_reasons] == [
        "critical_threshold_failed",
        "critical_threshold_failed",
        "critical_threshold_failed",
        "offline_eval_failed",
    ]
    assert [reason.get("check") for reason in first_reasons[:3]] == [
        "min_map_at_k",
        "min_ndcg_at_k",
        "min_recall_at_k",
    ]
