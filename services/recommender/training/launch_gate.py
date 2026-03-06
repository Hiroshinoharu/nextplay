from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _load_json(path: Path) -> dict[str, Any]:
    """
    Load a JSON object from a file path.

    Args:
        path: Path to the JSON file.

    Returns:
        dict[str, Any]: The loaded JSON object.

    Raises:
        ValueError: If the loaded data is not a dictionary.
    """
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object at {path}")
    return data


def _resolve_latest_run_log(runs_dir: Path) -> Path:
    """
    Resolve the latest run log file path under the given directory.

    Args:
        runs_dir: Path to the directory containing run logs.

    Returns:
        Path: The latest run log file path.

    Raises:
        FileNotFoundError: If no run_log.json is found under the given directory.
    """
    candidates: list[Path] = []
    for child in runs_dir.iterdir():
        if child.is_dir():
            run_log = child / "run_log.json"
            if run_log.exists():
                candidates.append(run_log)

    if not candidates:
        raise FileNotFoundError(f"No run_log.json found under {runs_dir}")

    return max(candidates, key=lambda path: path.stat().st_mtime)


def _offline_observed_checks(offline_eval: dict[str, Any]) -> dict[str, float]:
    """
    Extract observed quality metrics from an offline evaluation result.

    Args:
        offline_eval: Dictionary containing the offline evaluation result,
            including model, popularity baseline, and fallback baseline metrics.

    Returns:
        dict[str, float]: Dictionary mapping gate names to observed values.

    Notes:
        This function assumes that the input dictionary contains the required
        metrics for each gate. If a metric is missing, it will be replaced
        with a default value of 0.0.
    """
    model = offline_eval.get("model") or {}
    popularity = offline_eval.get("popularity_baseline") or {}
    fallback = offline_eval.get("rule_based_fallback_baseline") or {}

    def _as_float(container: dict[str, Any], key: str) -> float:
        """
        Safely extract a float value from a dictionary.

        Args:
            container (dict[str, Any]): The dictionary to extract from.
            key (str): The key to extract.

        Returns:
            float: The extracted value, or 0.0 if the key is not present in the dictionary.

        Notes:
            This function assumes that the extracted value can be safely converted to a float.
        """
        value = container.get(key, 0.0)
        return float(value)

    return {
        "min_recall_at_k": _as_float(model, "recall_at_k"),
        "min_ndcg_at_k": _as_float(model, "ndcg_at_k"),
        "min_map_at_k": _as_float(model, "map_at_k"),
        "min_coverage_at_k": _as_float(model, "coverage_at_k"),
        "min_list_diversity_at_k": _as_float(model, "list_diversity_at_k"),
        "min_recall_lift_vs_popularity": _as_float(model, "recall_at_k")
        - _as_float(popularity, "recall_at_k"),
        "min_ndcg_lift_vs_popularity": _as_float(model, "ndcg_at_k")
        - _as_float(popularity, "ndcg_at_k"),
        "min_map_lift_vs_popularity": _as_float(model, "map_at_k")
        - _as_float(popularity, "map_at_k"),
        "min_recall_lift_vs_fallback": _as_float(model, "recall_at_k")
        - _as_float(fallback, "recall_at_k"),
    }


def _critical_threshold_keys(
    offline_thresholds: dict[str, Any], launch_policy: dict[str, Any]
) -> list[str]:
    """
    Return a list of critical threshold keys from launch policy or offline thresholds.
    
    First, check if the launch policy contains a list of critical threshold keys.
    If it does, return the sorted list of keys.
    If it does not, return a sorted list of keys from the offline thresholds.
    """
    policy_keys = (
        launch_policy.get("offline_gate")
        or {}
    ).get("critical_thresholds")
    if isinstance(policy_keys, list) and policy_keys:
        return sorted({str(item) for item in policy_keys})

    return sorted(str(key) for key in offline_thresholds.keys())


def _build_decision(
    *,
    run_log: dict[str, Any],
    run_log_path: Path,
    offline_thresholds: dict[str, Any],
    launch_policy: dict[str, Any],
) -> dict[str, Any]:
    """
    Build a decision based on the offline evaluation results, offline thresholds, and launch policy.

    The decision is a dictionary containing the following keys:
    - decision: "pass" if the offline evaluation passed, "fail" otherwise.
    - can_launch: true if the offline evaluation passed, false otherwise.
    - generated_at: the time at which the decision was generated.
    - run_id: the run ID from the offline evaluation.
    - run_log_path: the path to the offline evaluation run log.
    - offline_thresholds_path: the path to the offline thresholds JSON file.
    - launch_policy_version: the version of the launch policy.
    - critical_checks: a list of critical threshold keys.
    - reasons: a list of dictionaries containing the reason for each critical check failure.

    The function returns a dictionary containing the decision and the reasons for the decision.
    """
    reasons: list[dict[str, Any]] = []
    offline_eval = (
        run_log.get("metrics")
        if isinstance(run_log.get("metrics"), dict)
        else {}
    )
    observed = _offline_observed_checks(offline_eval)

    if not bool(offline_eval.get("passed")):
        reasons.append(
            {
                "code": "offline_eval_failed",
                "severity": "critical",
                "message": "Offline evaluation did not pass.",
            }
        )

    critical_keys = _critical_threshold_keys(offline_thresholds, launch_policy)
    for key in critical_keys:
        required_value_raw = offline_thresholds.get(key)
        if required_value_raw is None:
            reasons.append(
                {
                    "code": "critical_threshold_missing",
                    "severity": "critical",
                    "check": key,
                    "message": f"Critical threshold '{key}' is missing from offline thresholds.",
                }
            )
            continue

        required_value = float(required_value_raw)
        observed_value = observed.get(key)
        if observed_value is None:
            reasons.append(
                {
                    "code": "critical_observed_metric_missing",
                    "severity": "critical",
                    "check": key,
                    "required": required_value,
                    "message": f"Observed value for critical threshold '{key}' is missing.",
                }
            )
            continue

        if float(observed_value) < required_value:
            reasons.append(
                {
                    "code": "critical_threshold_failed",
                    "severity": "critical",
                    "check": key,
                    "observed": float(observed_value),
                    "required": required_value,
                    "message": (
                        f"Critical check '{key}' failed: observed={float(observed_value):.6f} "
                        f"required>={required_value:.6f}"
                    ),
                }
            )

    reasons = sorted(
        reasons,
        key=lambda item: (
            str(item.get("severity", "")),
            str(item.get("code", "")),
            str(item.get("check", "")),
            str(item.get("message", "")),
        ),
    )
    can_launch = not any(reason.get("severity") == "critical" for reason in reasons)

    return {
        "decision": "pass" if can_launch else "fail",
        "can_launch": can_launch,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_id": run_log.get("run_id"),
        "run_log_path": str(run_log_path),
        "offline_thresholds_path": str(run_log.get("params", {}).get("thresholds_json", "")),
        "launch_policy_version": launch_policy.get("version"),
        "critical_checks": critical_keys,
        "reasons": reasons,
    }


def run_launch_gate(
    *,
    runs_dir: Path | None = None,
    run_dir: Path | None = None,
    offline_thresholds_json: Path = Path(
        "services/recommender/training/offline_eval_thresholds.json"
    ),
    launch_policy_json: Path = Path(
        "services/recommender/training/launch_validation_policy.json"
    ),
    decision_filename: str = "launch_gate_decision.json",
) -> dict[str, Any]:
    """
    Runs the launch gate, making a pass/fail decision based on
    offline evaluation results and launch policy.

    If `run_dir` is provided, it will be used as the directory
    containing the run log. Otherwise, the latest run log in
    `runs_dir` (defaulting to
    `services/recommender/training/runs`) will be used.

    The launch gate decision will be written to a file named
    `decision_filename` (defaulting to "launch_gate_decision.json")
    in the same directory as the run log.

    The decision file will contain the following information:
    - `decision`: either "pass" or "fail"
    - `can_launch`: a boolean indicating whether the launch gate
      decision is to pass or fail
    - `generated_at`: the timestamp of when the launch gate decision
      was generated
    - `run_id`: the ID of the run
    - `run_log_path`: the path to the run log
    - `offline_thresholds_path`: the path to the offline evaluation
      thresholds JSON file
    - `launch_policy_version`: the version of the launch policy
    - `critical_checks`: a list of critical checks (keys of the
      `offline_thresholds` dictionary)
    - `reasons`: a list of reasons for failing the launch gate
    - `decision_path`: the path to the decision file

    Returns a dictionary containing the launch gate decision.
    """
    if run_dir is not None:
        run_log_path = run_dir / "run_log.json"
        if not run_log_path.exists():
            raise FileNotFoundError(f"run_log.json not found in {run_dir}")
    else:
        resolved_runs_dir = runs_dir or Path("services/recommender/training/runs")
        run_log_path = _resolve_latest_run_log(resolved_runs_dir)

    run_log = _load_json(run_log_path)
    offline_thresholds = _load_json(offline_thresholds_json)
    launch_policy = _load_json(launch_policy_json)

    decision = _build_decision(
        run_log=run_log,
        run_log_path=run_log_path,
        offline_thresholds=offline_thresholds,
        launch_policy=launch_policy,
    )

    decision_path = run_log_path.parent / decision_filename
    decision_path.write_text(json.dumps(decision, indent=2), encoding="utf-8")
    decision["decision_path"] = str(decision_path)
    return decision


def _parse_args() -> argparse.Namespace:
    """
    Parses command-line arguments for running the launch gate checks.

    The script requires a runs directory (--runs_dir), but all other parameters have default values.
    The default runs directory is "services/recommender/training/runs".
    The default offline evaluation thresholds JSON file path is "services/recommender/training/offline_eval_thresholds.json".
    The default launch validation policy JSON file path is "services/recommender/training/launch_validation_policy.json".
    The default output decision filename is "launch_gate_decision.json".
    """
    parser = argparse.ArgumentParser(
        description="Run launch gate checks for the latest recommender retrain artifacts."
    )
    parser.add_argument(
        "--runs_dir",
        type=Path,
        default=Path("services/recommender/training/runs"),
        help="Directory containing retrain run folders.",
    )
    parser.add_argument(
        "--run_dir",
        type=Path,
        default=None,
        help="Specific run directory; if omitted, latest run under --runs_dir is used.",
    )
    parser.add_argument(
        "--thresholds_json",
        type=Path,
        default=Path("services/recommender/training/offline_eval_thresholds.json"),
        help="Offline evaluation thresholds JSON file.",
    )
    parser.add_argument(
        "--launch_policy_json",
        type=Path,
        default=Path("services/recommender/training/launch_validation_policy.json"),
        help="Launch validation policy JSON file.",
    )
    parser.add_argument(
        "--decision_filename",
        type=str,
        default="launch_gate_decision.json",
        help="Output decision filename written next to run_log.json.",
    )
    return parser.parse_args()


def main() -> None:
    """
    Entry point for the launch gate script.

    Parses command-line arguments using _parse_args(), runs the launch gate checks using run_launch_gate(), and prints the result as a JSON object.

    If the launch gate decision is to fail, raises SystemExit(1).

    :return: None
    :rtype: None
    """
    args = _parse_args()
    result = run_launch_gate(
        runs_dir=args.runs_dir,
        run_dir=args.run_dir,
        offline_thresholds_json=args.thresholds_json,
        launch_policy_json=args.launch_policy_json,
        decision_filename=args.decision_filename,
    )
    print(json.dumps(result, indent=2))
    if not result["can_launch"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
