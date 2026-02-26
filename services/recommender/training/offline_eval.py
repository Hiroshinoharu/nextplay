from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True)
class EvalResult:
    recall_at_k: float
    ndcg_at_k: float
    map_at_k: float
    coverage_at_k: float
    list_diversity_at_k: float

def _load_positive_labels(path: Path) -> dict[str, set[str]]:
    """Loads the positive labels from a CSV file and returns a dictionary mapping user IDs to sets of game IDs."""
    by_user: dict[str, set[str]] = {}
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("label") != "1":
                continue
            user_id = (row.get("user_id") or "").strip()
            game_id = (row.get("game_id") or "").strip()#
            if not user_id or not game_id:
                continue
            by_user.setdefault(user_id, set()).add(game_id)
    return by_user

def _load_interactions(path: Path) -> dict[str, set[str]]:
    """Loads the interactions from a CSV file and returns a dictionary mapping user IDs to sets of game IDs."""
    by_user: dict[str, set[str]] = {}
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            user_id = (row.get("user_id") or "").strip()
            game_id = (row.get("game_id") or "").strip()
            if not user_id or not game_id:
                continue
            by_user.setdefault(user_id, set()).add(game_id)
    return by_user

def _load_rankings(path: Path) -> dict[str, list[str]]:
    """Loads rankings from CSV and returns a dictionary mapping user IDs to ordered game IDs."""
    grouped: dict[str, list[tuple[int, str]]] = {}
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            user_id = (row.get("user_id") or "").strip()
            game_id = (row.get("game_id") or "").strip()
            if not user_id or not game_id:
                continue
            rank_raw = (row.get("rank") or "").strip()
            rank = int(rank_raw) if rank_raw else idx
            grouped.setdefault(user_id, []).append((rank, game_id))
    
    return{
        user_id: [game_id for _, game_id in sorted(values, key=lambda entry: entry[0])]
        for user_id, values in grouped.items()
    }

def _recall_at_k(relevant: set[str], predicted: list[str], k: int) -> float:
    """Calculates the recall at k. Recall at k is the proportion of relevant items that are in the top k predicted items. If there are no relevant items, recall is defined to be 0."""
    if not relevant:
        return 0.0
    hits = sum(1 for game_id in predicted[:k] if game_id in relevant)
    return hits / min(len(relevant), k)

def _dcg_at_k(relevant: set[str], predicted: list[str], k: int) -> float:
    """
    Calculates the NDCG at k (Normalized Discounted Cumulative Gain).
    
    NDCG is the DCG divided by IDCG, where:
    - DCG: sum of relevance scores discounted by rank (1/log2(rank+1))
    - IDCG: ideal DCG with all relevant items ranked first
    
    Returns 0 if there are no relevant items.
    """
    dcg = 0.0
    for idx , game_id in enumerate(predicted[:k]):
        if game_id in relevant:
            dcg += 1 / math.log2(idx + 2)  # i + 2 because ranks are 1-based and log2(1) = 0
    idcg = sum(1 / math.log2(idx + 2) for idx in range(min(len(relevant), k)))
    return dcg / idcg if idcg > 0 else 0.0

def _ndcg_at_k(relevant: set[str], predicted: list[str], k: int) -> float:
    """
    Calculates the NDCG at k. NDCG is the DCG divided by IDCG, 
    where DCG is the sum of relevance scores discounted by rank (1/log2(rank+1)) and IDCG is the ideal DCG with all relevant items ranked first. 
    Returns 0 if there are no relevant items.
    """
    dcg = 0.0
    for idx , game_id in enumerate(predicted[:k]):
        if game_id in relevant:
            dcg += 1 / math.log2(idx + 2)  # i + 2 because ranks are 1-based and log2(1) = 0
    idcg = sum(1 / math.log2(idx + 2) for idx in range(min(len(relevant), k)))
    return dcg / idcg if idcg > 0 else 0.0

def _average_precision_at_k(relevant: set[str], predicted: list[str], k: int) -> float:
    """Calculates the average precision at k. Average precision at k is the average of the precision at each rank where a relevant item is found in the top k predicted items. If there are no relevant items, average precision is defined to be 0."""
    if not relevant:
        return 0.0

    hits = 0
    precision_sum = 0.0
    for idx, game_id in enumerate(predicted[:k], start=1):
        if game_id in relevant:
            hits += 1
            precision_sum += hits / idx

    if hits == 0:
        return 0.0
    return precision_sum / min(len(relevant), k)

def evaluate_ranking(*, truth: dict[str, set[str]], rankings: dict[str, list[str]], k: int, catalog: set[str]) -> EvalResult:
    """ 
    Evaluates the ranking using recall at k, NDCG at k, average precision at k, coverage at k, and list diversity at k.
    - recall_at_k: the average recall at k across all users
    - ndcg_at_k: the average NDCG at k across all users
    - map_at_k: the average mean average precision at k across all users
    - coverage_at_k: the proportion of unique items recommended in the top k across all users compared to the total number of items in the catalog
    - list_diversity_at_k: the average pairwise dissimilarity between items in the top k recommendations across all users (using Jaccard distance)
    """
    users = sorted(truth.keys())
    if not users:
        return EvalResult(0.0, 0.0, 0.0, 0.0, 0.0)
    
    recalls: list[float] = []
    ndcgs: list[float] = []
    maps: list[float] = []
    
    topk_sets: list[set[str]] = []
    for user_id in users:
        relevant = truth[user_id]
        predicted = rankings.get(user_id, [])
        
        recalls.append(_recall_at_k(relevant, predicted, k))
        ndcgs.append(_ndcg_at_k(relevant, predicted, k))
        maps.append(_average_precision_at_k(relevant, predicted, k))
        
        topk_sets.append(set(predicted[:k]))
    
    unique_recommended = set().union(*topk_sets) if topk_sets else set()
    coverage = len(unique_recommended) / len(catalog) if catalog else 0.0
    avg_list_diversity = sum((len(s) / k) if k > 0 else 0.0 for s in topk_sets) / len(topk_sets) if topk_sets else 0.0
    
    return EvalResult(
        recall_at_k=sum(recalls) / len(recalls),
        ndcg_at_k=sum(ndcgs) / len(ndcgs),
        map_at_k=sum(maps) / len(maps),
        coverage_at_k=coverage,
        list_diversity_at_k=avg_list_diversity
    )

def _popularity_baseline(
    *,
    users: list[str],
    train_path: Path,
    seen_interactions: dict[str, set[str]],
    k: int,
) -> dict[str, list[str]]:
    """Generates a popularity baseline ranking for each user based on the most popular items in the training data that the user has not interacted with."""
    populairty: dict[str, int] = {}
    with train_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("label") != "1":
                continue
            game_id = (row.get("game_id") or "").strip()
            if not game_id:
                continue
            populairty[game_id] = populairty.get(game_id, 0) + 1
    
    ranked_games = [
        game_id
        for game_id, _ in sorted(populairty.items(), key=lambda item: (-item[1], item[0]))
    ]
    
    output: dict[str, list[str]] = {}
    for user_id in users:
        seen = seen_interactions.get(user_id, set())
        output[user_id] = [game for game in ranked_games if game not in seen][:k]
    return output

def _rule_based_fallback_baseline(*, users: list[str], k: int) -> dict[str, list[str]]:
    """
    Generates a rule-based fallback baseline ranking for each user.
    
    For each user, creates a list of k game IDs by using the user ID as a base
    and incrementing it. If the user ID is not a valid integer, defaults to base ID 70.
    This ensures every user gets a ranking even when other methods fail.

    Args:
        users (list[str]): List of user IDs to generate rankings for.
        k (int): Number of game recommendations to generate per user.

    Returns:
        dict[str, list[str]]: Dictionary mapping user IDs to lists of k game IDs.
    """
    result: dict[str, list[str]] = {}
    for user_id in users:
        try:
            base_id = int(user_id)
        except ValueError:
            base_id = 70
        result[user_id] = [str(base_id + offset) for offset in range(1, k + 1)]
    return result

def _load_threshold(path: Path) -> dict[str, float]:
    """Loads a threshold configuration from a JSON file and returns a dictionary mapping threshold names to float values."""
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return {k: float(v) for k, v in data.items()}

def _evaluate_gates(
    *,
    model: EvalResult,
    popularity: EvalResult,
    fallback: EvalResult,
    threshold: dict[str, float],
) -> tuple[bool, list[str]]:
    """
    Evaluate a recommendation model against multiple quality gates and thresholds.
    Compares model performance metrics against popularity and fallback baselines,
    checking if observed values meet or exceed required thresholds.
    Args:
        model: Evaluation results for the primary recommendation model.
        popularity: Evaluation results for the popularity-based baseline.
        fallback: Evaluation results for the fallback recommendation baseline.
        threshold: Dictionary mapping gate names to minimum required values.
                  Supported gates: min_recall_at_k, min_ndcg_at_k, min_map_at_k,
                  min_coverage_at_k, min_list_diversity_at_k,
                  min_recall_lift_vs_popularity, min_ndcg_lift_vs_popularity,
                  min_map_lift_vs_popularity, min_recall_lift_vs_fallback.
    Returns:
        A tuple containing:
        - bool: True if all quality gates pass, False otherwise.
        - list[str]: List of failure messages for gates that did not meet thresholds.
                    Empty list if all gates pass.
    """
    checks = {
        "min_recall_at_k": model.recall_at_k,
        "min_ndcg_at_k": model.ndcg_at_k,
        "min_map_at_k": model.map_at_k,
        "min_coverage_at_k": model.coverage_at_k,
        "min_list_diversity_at_k": model.list_diversity_at_k,
        "min_recall_lift_vs_popularity": model.recall_at_k - popularity.recall_at_k,
        "min_ndcg_lift_vs_popularity": model.ndcg_at_k - popularity.ndcg_at_k,
        "min_map_lift_vs_popularity": model.map_at_k - popularity.map_at_k,
        "min_recall_lift_vs_fallback": model.recall_at_k - fallback.recall_at_k,
    }
    
    failures: list[str] = []
    for gate, observed in checks.items():
        required = threshold.get(gate)
        if required is None:
            continue
        if observed < required:
            failures.append(f"{gate}: observed={observed:.4f} required>={required:.4f}")
    
    return len(failures) == 0, failures

def run_offline_evaluation(
    *,
    train_csv: Path,
    test_csv: Path,
    predictions_csv: Path,
    thresholds_json: Path,
    k: int,
) -> dict[str, object]:
    truth = _load_positive_labels(test_csv)
    rankings = _load_rankings(predictions_csv)
    seen = _load_interactions(train_csv)
    
    users = sorted(truth.keys())
    popularity_rankings = _popularity_baseline(users=users, train_path=train_csv, seen_interactions=seen, k=k)
    fallback_rankings = _rule_based_fallback_baseline(users=users, k=k)
    
    catalog = set()
    for row in rankings.values():
        catalog.update(row[:k])
    for row in popularity_rankings.values():
        catalog.update(row[:k])
    for row in fallback_rankings.values():
        catalog.update(row[:k])
    
    model_metrics = evaluate_ranking(truth=truth, rankings=rankings, k=k, catalog=catalog)
    popularity_metrics = evaluate_ranking(truth=truth, rankings=popularity_rankings, k=k, catalog=catalog)
    fallback_metrics = evaluate_ranking(truth=truth, rankings=fallback_rankings, k=k, catalog=catalog)
    
    threshold = _load_threshold(thresholds_json)
    passed, failures = _evaluate_gates(
        model=model_metrics,
        popularity=popularity_metrics,
        fallback=fallback_metrics,
        threshold=threshold,
    )
    
    return {
        "k": k,
        "passed": passed,
        "model": model_metrics.__dict__,
        "popularity_baseline": popularity_metrics.__dict__,
        "rule_based_fallback_baseline": fallback_metrics.__dict__,
        "thresholds": threshold,
        "gate_failures": failures,
    }

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate recommender ranking quality with acceptance gates.")
    parser.add_argument("--train_csv", type=Path, required=True, help="Training split CSV with user_id/game_id/label columns.")
    parser.add_argument("--test_csv", type=Path, required=True, help="Test split CSV with user_id/game_id/label columns.")
    parser.add_argument("--predictions_csv", type=Path, required=True, help="Model top-K predictions CSV with user_id/game_id/rank columns.")
    parser.add_argument("--thresholds_json", type=Path, default=Path("services/recommender/training/offline_eval_thresholds.json"), help="Path to acceptance thresholds JSON.")
    parser.add_argument("--k", type=int, default=10, help="Cutoff value K for ranking metrics.")
    return parser.parse_args()

def main() -> None:
    args = _parse_args()
    result = run_offline_evaluation(
        train_csv=args.train_csv,
        test_csv=args.test_csv,
        predictions_csv=args.predictions_csv,
        thresholds_json=args.thresholds_json,
        k=args.k,
    )
    print(json.dumps(result, indent=2))
    if not result["passed"]:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
