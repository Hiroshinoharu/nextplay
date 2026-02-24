from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from .model_schema import ModelCandidateScore, ModelInputSchema, ModelOutputSchema

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
        base_id = payload.user_id or 70
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

    def infer(self, payload: ModelInputSchema) -> ModelOutputSchema:
        feature_vector = _build_feature_vector(payload)
        scores = _predict_scores(self.model, feature_vector)

        ranked = sorted(
            enumerate(scores, start=1),
            key=lambda row: row[1],
            reverse=True,
        )

        candidates = [
            ModelCandidateScore(game_id=game_id, score=float(score), rank=rank)
            for rank, (game_id, score) in enumerate(ranked[:10], start=1)
        ]

        return ModelOutputSchema(
            user_id=payload.user_id,
            strategy="keras_inference_v1",
            candidates=candidates,
        )

def build_inference_service(model: Any | None) -> InferenceService:
    """
    Factory function to build an inference service based on the loaded model.

    Args:
        model (Any | None): The loaded model object, or None if no model is available.
    Returns:
        InferenceService: An instance of an inference service implementation.
    """
    if model is not None:
        return KerasInferenceService(model=model)
    else:
        return RuleBasedInferenceService()

def _build_feature_vector(payload: ModelInputSchema) -> list[float]:
    """
    Build a simple feature vector from the input schema for demonstration purposes.

    Args:
        payload (ModelInputSchema): The normalized input data for the model.

    Returns:
        list[float]: A simple feature vector representing the input data, which can be used for model inference.
    """
    return [
        float(len(payload.liked_keyword_ids)),
        float(len(payload.liked_platform_ids)),
        float(len(payload.disliked_keyword_ids)),
        float(len(payload.disliked_platform_ids)),
    ]

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
    raw_predictions = model.predict([feature_vector])

    first_row = raw_predictions[0] if raw_predictions else []
    if hasattr(first_row, "tolist"):
        first_row = first_row.tolist()

    return [float(score) for score in first_row]