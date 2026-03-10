import json
from pathlib import Path


def _catalog_path() -> Path:
    """
    Returns the path to the questionnaire catalog JSON file.

    This function returns the path to the questionnaire catalog JSON file
    in the shared/recommender directory.

    Returns:
        Path: The path to the questionnaire catalog JSON file.
    """
    return Path(__file__).resolve().parents[4] / "shared" / "recommender" / "questionnaire_v1.json"


def test_questionnaire_catalog_exists_and_question_count_is_in_target_range() -> None:
    """
    Verifies that the questionnaire catalog JSON file exists and contains
    a target range of questions.

    This test checks for the existence of the questionnaire catalog JSON file
    in the shared/recommender directory and verifies that it contains
    between 8 and 12 questions.

    The test also checks that the questionnaire version and feature schema version
    match the expected values.
    """
    payload = json.loads(_catalog_path().read_text(encoding="utf-8"))
    questions = payload.get("questions", [])

    assert payload["version"] == "questionnaire_v1"
    assert payload["feature_schema_version"] == "recommender_feature_schema_v1"
    assert 8 <= len(questions) <= 12


def test_questionnaire_catalog_option_mappings_match_request_shape() -> None:
    """
    Verifies that the questionnaire catalog JSON file contains option mappings that match the request shape.

    This test checks that each question in the questionnaire catalog JSON file has
    a type of either "single_select" or "multi_select", and that each option within
    each question has a mapping that contains the keys "liked_keywords", "disliked_keywords",
    "liked_platforms", and "disliked_platforms".

    The test also checks that each of the mapping values is a list of integers.
    """
    payload = json.loads(_catalog_path().read_text(encoding="utf-8"))
    questions = payload["questions"]

    expected_mapping_keys = {
        "liked_keywords",
        "disliked_keywords",
        "liked_platforms",
        "disliked_platforms",
    }

    for question in questions:
        assert question["type"] in {"single_select", "multi_select"}
        for option in question["options"]:
            mapping = option["mapping"]
            assert set(mapping.keys()) == expected_mapping_keys
            for key in expected_mapping_keys:
                assert isinstance(mapping[key], list)
                assert all(isinstance(item, int) for item in mapping[key])
