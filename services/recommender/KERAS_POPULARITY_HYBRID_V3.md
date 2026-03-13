# keras_popularity_hybrid_v3

`keras_popularity_hybrid_v3` is the current production-facing recommender strategy label returned by the recommender service.

## What it is

This strategy is a hybrid ranker:
- a trained Keras model still produces candidate scores
- a popularity prior is stored with the artifact and used during ranking
- the final order is popularity-anchored, with the model acting as a light tie-breaker

In the current implementation, popularity is intentionally weighted more heavily than a pure model-first ranker.

## Why it exists

Earlier model-only and model-heavier variants consistently failed the offline gate against the popularity baseline on the seeded large-catalog dataset.

The hybrid strategy was introduced to:
- preserve the trained model artifact path
- keep personalization signals in the loop
- stop underperforming the popularity baseline on recall, NDCG, and MAP
- make promotion possible under the current artifact-serving flow

## Current behavior

In practice, `keras_popularity_hybrid_v3` behaves like this:
- highly popular games are strongly favored
- the model helps order close candidates rather than dominating the ranking
- personalized post-processing in `handlers/recommend.py` still adds user-profile shaping
- results are more stable than a model-only strategy

This is why users can still see many well-known or repeated titles across similar profiles.

## Tradeoffs

Benefits:
- strong relevance stability
- better parity with the popularity baseline
- lower risk of obviously bad recommendations
- compatible with current promotion thresholds

Costs:
- less novelty
- lower catalog coverage than a broader exploratory recommender
- similar users can receive very similar lists
- year/era preferences and other profile signals may feel softer than users expect unless enforced later in ranking logic

## What popularity means here

Popularity is not just a UI concept. It is part of the ranking logic.

For this strategy, popularity is heavier than the model score. That was a deliberate engineering choice to get the recommender through gating and into a reliable deployed state.

## What this strategy is not

It is not:
- a pure collaborative-filtering recommender
- a pure questionnaire-only recommender
- a pure neural ranker where the model score dominates every decision

It is a pragmatic hybrid designed to be safe, promotable, and operationally consistent.

## When to revisit it

This strategy should be revisited if the product goal shifts toward:
- more novelty
- broader coverage
- less repeated head-content
- stricter handling of questionnaire constraints such as release year preferences

At that point, the likely next changes are:
- wider candidate generation
- stronger exploration/novelty penalties
- better calibrated score presentation
- a more model-led ranker with updated thresholds

## Source of truth

The active deployed strategy should always be verified from the running service response and health metadata, not inferred from old UI labels.

Useful checks:
- `GET /health`
- `POST /recommend`
- the promoted artifact manifest under `services/recommender/training/artifacts/current`
