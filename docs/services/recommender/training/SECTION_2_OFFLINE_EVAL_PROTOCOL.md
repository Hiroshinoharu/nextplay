# Section 2: Offline Evaluation Protocol

This protocol defines how to evaluate top-N ranking quality before a recommender model is accepted.

## Metrics at K

The evaluator computes the following metrics using positive labels (`label=1`) in the test split:

- **Recall@K**
- **NDCG@K**
- **MAP@K**
- **Coverage@K**: fraction of catalog items that appear in top-K recommendations.
- **List diversity@K**: average unique-item ratio inside each user top-K list.

## Baselines

The evaluator always compares model outputs against two baselines:

1. **Popularity baseline**
   - Built from positive-label frequency in the training split.
   - Removes user-seen train items before ranking.
2. **Rule-based fallback baseline**
   - Mirrors `rule_based_fallback_v1` from runtime inference.

## Acceptance gates

Default gates are stored in:

- `services/recommender/training/offline_eval_thresholds.json`

A run is accepted only when all configured thresholds pass, including:

- absolute quality minimums (`min_recall_at_k`, `min_ndcg_at_k`, `min_map_at_k`)
- minimum catalog/within-list checks (`min_coverage_at_k`, `min_list_diversity_at_k`)
- minimum lift vs baselines (`min_*_lift_vs_popularity`, `min_recall_lift_vs_fallback`)

## CLI usage

```bash
python -m services.recommender.training.offline_eval \
  --train_csv path/to/train.csv \
  --test_csv path/to/test.csv \
  --predictions_csv path/to/model_predictions.csv \
  --thresholds_json services/recommender/training/offline_eval_thresholds.json \
  --k 10
```

The command prints a JSON report and exits with status code `1` when any gate fails.
