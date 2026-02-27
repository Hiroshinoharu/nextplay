import json

import pytest

from services.recommender.models.artifact_manifest import load_artifact_manifest
from services.recommender.models.feature_contract import FEATURE_SCHEMA_VERSION

def _write_manifest(path, *, model_version="v1", feature_schema_version=FEATURE_SCHEMA_VERSION, candidate_map="candidate_map.json"):
    """
    Write a manifest configuration file to the specified path.

    Args:
        path: Path object where the manifest JSON will be written.
        model_version (str, optional): Version identifier for the model. Defaults to "v1".
        feature_schema_version (str, optional): Version of the feature schema. Defaults to FEATURE_SCHEMA_VERSION.
        candidate_map (str, optional): Name of the candidate index map file. Defaults to "candidate_map.json".

    Returns:
        None

    Notes:
        The manifest includes model metadata, feature schema version, candidate index map path,
        training configuration (learning rate: 0.001), and random seed (123).
    """
    payload = {
        "model_version": model_version,
        "feature_schema_version": feature_schema_version,
        "candidate_index_map_path": candidate_map,
        "training_config": {"learning_rate": 0.001},
        "random_seed": 123,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_load_artifact_manifest_happy_path(tmp_path):
    """
    Test that load_artifact_manifest correctly loads a manifest file with all expected attributes.
    This test verifies the happy path scenario where:
    - A model file exists at the specified path
    - A candidate map JSON file exists
    - A manifest JSON file is properly formatted
    - The manifest can be successfully loaded and parsed
    Assertions verify that the loaded manifest contains:
    - The correct feature schema version
    - The correct random seed value
    """
    model_path = tmp_path / "model.keras"
    model_path.write_text("model", encoding="utf-8")
    candidate_map = tmp_path / "candidate_map.json"
    candidate_map.write_text("{}", encoding="utf-8")
    manifest_path = tmp_path / "model.manifest.json"
    _write_manifest(manifest_path)
    
    manifest = load_artifact_manifest(
        manifest_path=str(manifest_path),
        model_path=str(model_path),
        expected_model_version="v1",
    )
    
    assert manifest.feature_schema_version == FEATURE_SCHEMA_VERSION
    assert manifest.random_seed == 123

def test_load_artifact_manifest_raises_on_schema_mismatch(tmp_path):
    """
    Test that load_artifact_manifest raises RuntimeError when feature_schema_version mismatches.
    This test verifies that the load_artifact_manifest function properly validates
    the feature_schema_version in the manifest file and raises a RuntimeError with
    a "feature_schema_version mismatch" message when the version (v999) does not
    match the expected schema version.
    The test creates a temporary directory with:
    - A mock model.keras file
    - A mock candidate_map.json file
    - A manifest file with an invalid feature_schema_version
    Expected behavior: RuntimeError is raised during manifest loading.
    """
    model_path = tmp_path / "model.keras"
    model_path.write_text("model", encoding="utf-8")
    candidate_map = tmp_path / "candidate_map.json"
    candidate_map.write_text("{}", encoding="utf-8")
    manifest_path = tmp_path / "model.manifest.json"
    _write_manifest(manifest_path, feature_schema_version="recommender_feature_schema_v999")
    
    with pytest.raises(RuntimeError, match="feature_schema_version mismatch"):
        load_artifact_manifest(
            manifest_path=str(manifest_path),
            model_path=str(model_path),
            expected_model_version="v1",
        )

def test_load_artifact_manifest_raises_on_candidate_map_missing(tmp_path):
    """
    Test that load_artifact_manifest raises RuntimeError when candidate map file is missing.
    This test verifies that the load_artifact_manifest function properly validates
    the existence of the candidate_index_map_path specified in the manifest file.
    When the manifest references a non-existent candidate map file, the function
    should raise a RuntimeError with an appropriate error message.
    Fixtures:
        tmp_path: pytest fixture providing a temporary directory
    Assertions:
        - RuntimeError is raised with message "candidate_index_map_path does not exist"
        - Error is raised during load_artifact_manifest call with missing candidate map
    """
    model_path = tmp_path / "model.keras"
    model_path.write_text("model", encoding="utf-8")
    manifest_path = tmp_path / "model.manifest.json"
    _write_manifest(manifest_path, candidate_map="missing_map.json")

    with pytest.raises(RuntimeError, match="candidate_index_map_path does not exist"):
        load_artifact_manifest(
            manifest_path=str(manifest_path),
            model_path=str(model_path),
            expected_model_version="v1",
        )