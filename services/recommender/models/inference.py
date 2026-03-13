from __future__ import annotations

from dataclasses import dataclass
import importlib
import math
from typing import Any, Protocol

from .feature_contract import build_feature_vector_from_payload
from .model_schema import ModelCandidateScore, ModelInputSchema, ModelOutputSchema

MAX_MODEL_CANDIDATES = 100
MODEL_SCORE_TIEBREAKER_WEIGHT = 1e-6


class InferenceService(Protocol):
    def infer(self, payload: ModelInputSchema) -> ModelOutputSchema:
        """Perform inference based on the input schema and return the output schema."""


@dataclass
class RuleBasedInferenceService:
    """Fallback inference implementation when no trained model is available."""

    def infer(self, payload: ModelInputSchema) -> ModelOutputSchema:
        base_id = 70
        candidates = [
            ModelCandidateScore(game_id=base_id + offset, score=float(6 - offset), rank=offset)
            for offset in range(1, 6)
        ]
        return ModelOutputSchema(
            user_id=payload.user_id,
            strategy="rule_based_fallback_v1",
            candidates=candidates,
        )


@dataclass
class KerasInferenceService:
    """Inference implementation that wraps a loaded Keras-compatible model."""

    model: Any
    candidate_index_map: dict[int, int] | None = None
    popularity_prior_map: dict[int, float] | None = None

    def infer(self, payload: ModelInputSchema) -> ModelOutputSchema:
        feature_vector = build_feature_vector_from_payload(payload)
        scores = _predict_scores(self.model, feature_vector)
        valid_scores: list[tuple[int, float, float]] = []
        for candidate_index, score in enumerate(scores, start=1):
            if not math.isfinite(score):
                continue

            game_id = self._resolve_game_id(candidate_index)
            if game_id is None:
                continue

            hybrid_score = _combine_scores(
                model_score=float(score),
                popularity_prior=self.popularity_prior_map.get(candidate_index, 0.0)
                if self.popularity_prior_map is not None
                else 0.0,
            )
            valid_scores.append((game_id, hybrid_score, float(score)))

        ranked = sorted(valid_scores, key=lambda row: row[1], reverse=True)
        candidates = [
            ModelCandidateScore(game_id=game_id, score=model_score, rank=rank)
            for rank, (game_id, _hybrid_score, model_score) in enumerate(ranked[:MAX_MODEL_CANDIDATES], start=1)
        ]

        strategy = "keras_popularity_hybrid_v1" if self.popularity_prior_map else "keras_inference_v1"
        return ModelOutputSchema(
            user_id=payload.user_id,
            strategy=strategy,
            candidates=candidates,
        )

    def _resolve_game_id(self, candidate_index: int) -> int | None:
        if self.candidate_index_map is None:
            return candidate_index
        return self.candidate_index_map.get(candidate_index)


def build_inference_service(
    model: Any | None,
    candidate_index_map: dict[int, int] | None = None,
    popularity_prior_map: dict[int, float] | None = None,
) -> InferenceService:
    if model is not None:
        return KerasInferenceService(
            model=model,
            candidate_index_map=candidate_index_map,
            popularity_prior_map=popularity_prior_map,
        )
    return RuleBasedInferenceService()


def _combine_scores(*, model_score: float, popularity_prior: float) -> float:
    return float(popularity_prior) + (MODEL_SCORE_TIEBREAKER_WEIGHT * float(model_score))


def _predict_scores(model: Any, feature_vector: list[float]) -> list[float]:
    numpy_module = importlib.import_module("numpy")
    batch = numpy_module.asarray([feature_vector], dtype="float32")
    try:
        raw_predictions = model.predict(batch, verbose=0)
    except TypeError as exc:
        if "verbose" not in str(exc):
            raise
        raw_predictions = model.predict(batch.tolist())

    if hasattr(raw_predictions, "tolist"):
        raw_predictions = raw_predictions.tolist()
    if not raw_predictions:
        return []
    first_row = raw_predictions[0]
    if hasattr(first_row, "tolist"):
        first_row = first_row.tolist()
    return [float(score) for score in first_row]
