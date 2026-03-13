from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from .feature_contract import FEATURE_SCHEMA_VERSION


class ArtifactManifest(BaseModel):
    """Metadata contract for recommender model artifacts."""

    model_version: str
    feature_schema_version: str
    candidate_index_map_path: str
    popularity_prior_path: str | None = None
    training_config: dict[str, Any] = Field(default_factory=dict)
    random_seed: int | None = None
    dataset_hash: str | None = None
    git_commit: str | None = None


def load_artifact_manifest(*, manifest_path: str, model_path: str | None, expected_model_version: str) -> ArtifactManifest:
    """Load and validate model artifact metadata required for serving compatibility."""
    resolved_manifest_path = Path(manifest_path).expanduser().resolve()
    if not resolved_manifest_path.exists():
        raise RuntimeError(f"MODEL_MANIFEST_PATH does not exist: {resolved_manifest_path}")

    with resolved_manifest_path.open("r", encoding="utf-8") as manifest_file:
        payload = json.load(manifest_file)

    manifest = ArtifactManifest.model_validate(payload)

    if manifest.feature_schema_version != FEATURE_SCHEMA_VERSION:
        raise RuntimeError(
            "Artifact manifest feature_schema_version mismatch: "
            f"expected '{FEATURE_SCHEMA_VERSION}', got '{manifest.feature_schema_version}'"
        )

    if manifest.model_version != expected_model_version:
        raise RuntimeError(
            "Artifact manifest model_version mismatch: "
            f"expected '{expected_model_version}', got '{manifest.model_version}'"
        )

    candidate_map_path = Path(manifest.candidate_index_map_path)
    if not candidate_map_path.is_absolute():
        candidate_map_path = (resolved_manifest_path.parent / candidate_map_path).resolve()
    if not candidate_map_path.exists():
        raise RuntimeError(
            "Artifact manifest candidate_index_map_path does not exist: "
            f"{candidate_map_path}"
        )

    if manifest.popularity_prior_path:
        popularity_prior_path = Path(manifest.popularity_prior_path)
        if not popularity_prior_path.is_absolute():
            popularity_prior_path = (resolved_manifest_path.parent / popularity_prior_path).resolve()
        if not popularity_prior_path.exists():
            raise RuntimeError(
                "Artifact manifest popularity_prior_path does not exist: "
                f"{popularity_prior_path}"
            )

    if model_path:
        resolved_model_path = Path(model_path).expanduser().resolve()
        if not resolved_model_path.exists():
            raise RuntimeError(f"MODEL_PATH does not exist: {resolved_model_path}")

    return manifest
