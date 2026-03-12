from __future__ import annotations

from dataclasses import dataclass
import importlib
import math
from typing import Any, Protocol

from .feature_contract import build_feature_vector_from_payload
from .model_schema import ModelCandidateScore, ModelInputSchema, ModelOutputSchema

MAX_MODEL_CANDIDATES = 100

class InferenceService(Protocol):
    """
    Protocol for inference service that can be implemented with different ML frameworks.

    Args:
        Protocol (class): Base class for defining a protocol that can be implemented by different inference services.
    """
    def infer(self, payload: ModelInputSchema) -> ModelOutputSchema:
        """
        Perform inference based on the input schema and return the output schema.

        Args:
            payload (ModelInputSchema): Normalized input data for the model.
        Returns:
            ModelOutputSchema: Normalized output data from the model.
        """

# The @dataclass decorator is not strictly necessary here since we are defining a Protocol, but it can be used for consistency if we want to implement a concrete class later.
@dataclass
class RuleBasedInferenceService:
    """Fallback inference implementation when no trained model is available."""
    def infer(self, payload: ModelInputSchema) -> ModelOutputSchema:
        # Keep fallback recommendations stable for backward compatibility.
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
    """
    Inference implmentation that wraps a loaded Keras-compatible model.
    """
    
    # Model can be any type depending on the ML framework used; we use Any for flexibility.
    model: Any
    candidate_index_map: dict[int, int] | None = None  # Optional mapping from model output indices to game IDs

    def infer(self, payload: ModelInputSchema) -> ModelOutputSchema:
        feature_vector = build_feature_vector_from_payload(payload)
        scores = _predict_scores(self.model, feature_vector)
        valid_scores: list[tuple[int, float]] = []
        for candidate_index, score in enumerate(scores, start = 1):
            if not math.isfinite(score):
                continue
            
            game_id = self._resolve_game_id(candidate_index)
            if game_id is None:
                continue
            
            valid_scores.append((game_id, score))

        ranked = sorted(
            valid_scores,
            key=lambda row: row[1],
            reverse=True,
        )

        candidates = [
            ModelCandidateScore(game_id=game_id, score=float(score), rank=rank)
            for rank, (game_id, score) in enumerate(ranked[:MAX_MODEL_CANDIDATES], start=1)
        ]

        return ModelOutputSchema(
            user_id=payload.user_id,
            strategy="keras_inference_v1",
            candidates=candidates,
        )
    
    def _resolve_game_id(self, candidate_index: int) -> int | None:
        """Resolve model candidate index to externally valid game_id.

        Failure behavior: if a candidate index map is configured and the index is missing,
        the candidate is skipped to avoid returning invalid IDs to clients.
        """
        if self.candidate_index_map is None:
            return candidate_index

        return self.candidate_index_map.get(candidate_index)

def build_inference_service(model: Any | None, candidate_index_map: dict[int, int] | None = None) -> InferenceService:
    """
    Factory function to build an inference service based on the loaded model.

    Args:
        model (Any | None): The loaded model object, or None if no model is available.
        candidate_index_map (dict[int, int] | None): An optional mapping from model output indices to game IDs.
    Returns:
        InferenceService: An instance of an inference service implementation.
    """
    if model is not None:
        return KerasInferenceService(model=model, candidate_index_map=candidate_index_map)
    else:
        return RuleBasedInferenceService()

def _predict_scores(model: Any, feature_vector: list[float]) -> list[float]:
    """
    Boundary for invoking the model's prediction API. 
    In a real implementation, this would call the model's predict method and handle any necessary preprocessing or postprocessing.

    Args:
        model (Any): The loaded model object that has a predict method.
        feature_vector (list[float]): The input feature vector to be passed to the model for prediction.

    Returns:
        list[float]: A list of predicted scores for candidate games, which can be used to rank the recommendations.
    """
    numpy_module = importlib.import_module("numpy")
    batch = numpy_module.asarray([feature_vector], dtype="float32")
    raw_predictions = model.predict(batch, verbose=0)

    if hasattr(raw_predictions, "tolist"):
        raw_predictions = raw_predictions.tolist()
    if not raw_predictions:
        return []
    first_row = raw_predictions[0]
    if hasattr(first_row, "tolist"):
        first_row = first_row.tolist()
    return [float(score) for score in first_row]
