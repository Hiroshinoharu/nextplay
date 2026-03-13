import json

import pytest

from services.recommender.models.artifact_manifest import load_artifact_manifest
from services.recommender.models.feature_contract import FEATURE_SCHEMA_VERSION


def _write_manifest(
    path,
    *,
    model_version="v1",
    feature_schema_version=FEATURE_SCHEMA_VERSION,
    candidate_map="candidate_map.json",
    popularity_prior="popularity_prior.json",
):
    payload = {
        "model_version": model_version,
        "feature_schema_version": feature_schema_version,
        "candidate_index_map_path": candidate_map,
        "popularity_prior_path": popularity_prior,
        "training_config": {"learning_rate": 0.001},
        "random_seed": 123,
        "dataset_hash": "dataset-sha",
        "git_commit": "git-sha",
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_load_artifact_manifest_happy_path(tmp_path):
    model_path = tmp_path / "model.keras"
    model_path.write_text("model", encoding="utf-8")
    candidate_map = tmp_path / "candidate_map.json"
    candidate_map.write_text("{}", encoding="utf-8")
    popularity_prior = tmp_path / "popularity_prior.json"
    popularity_prior.write_text("{}", encoding="utf-8")
    manifest_path = tmp_path / "model.manifest.json"
    _write_manifest(manifest_path)

    manifest = load_artifact_manifest(
        manifest_path=str(manifest_path),
        model_path=str(model_path),
        expected_model_version="v1",
    )

    assert manifest.feature_schema_version == FEATURE_SCHEMA_VERSION
    assert manifest.random_seed == 123
    assert manifest.dataset_hash == "dataset-sha"
    assert manifest.git_commit == "git-sha"
    assert manifest.popularity_prior_path == "popularity_prior.json"


def test_load_artifact_manifest_raises_on_schema_mismatch(tmp_path):
    model_path = tmp_path / "model.keras"
    model_path.write_text("model", encoding="utf-8")
    candidate_map = tmp_path / "candidate_map.json"
    candidate_map.write_text("{}", encoding="utf-8")
    popularity_prior = tmp_path / "popularity_prior.json"
    popularity_prior.write_text("{}", encoding="utf-8")
    manifest_path = tmp_path / "model.manifest.json"
    _write_manifest(manifest_path, feature_schema_version="recommender_feature_schema_v999")

    with pytest.raises(RuntimeError, match="feature_schema_version mismatch"):
        load_artifact_manifest(
            manifest_path=str(manifest_path),
            model_path=str(model_path),
            expected_model_version="v1",
        )


def test_load_artifact_manifest_raises_on_candidate_map_missing(tmp_path):
    model_path = tmp_path / "model.keras"
    model_path.write_text("model", encoding="utf-8")
    popularity_prior = tmp_path / "popularity_prior.json"
    popularity_prior.write_text("{}", encoding="utf-8")
    manifest_path = tmp_path / "model.manifest.json"
    _write_manifest(manifest_path, candidate_map="missing_map.json")

    with pytest.raises(RuntimeError, match="candidate_index_map_path does not exist"):
        load_artifact_manifest(
            manifest_path=str(manifest_path),
            model_path=str(model_path),
            expected_model_version="v1",
        )


def test_load_artifact_manifest_raises_on_popularity_prior_missing(tmp_path):
    model_path = tmp_path / "model.keras"
    model_path.write_text("model", encoding="utf-8")
    candidate_map = tmp_path / "candidate_map.json"
    candidate_map.write_text("{}", encoding="utf-8")
    manifest_path = tmp_path / "model.manifest.json"
    _write_manifest(manifest_path, popularity_prior="missing_prior.json")

    with pytest.raises(RuntimeError, match="popularity_prior_path does not exist"):
        load_artifact_manifest(
            manifest_path=str(manifest_path),
            model_path=str(model_path),
            expected_model_version="v1",
        )
