# Shared Questionnaire Mapping (v1)

This folder contains the shared questionnaire taxonomy used by frontend and backend.

## File

- `questionnaire_v1.json`: Source-of-truth question catalog and answer-to-feature mapping.

## Contract

Each option maps to the currently supported recommender request fields:

- `liked_keywords`
- `disliked_keywords`
- `liked_platforms`
- `disliked_platforms`

The frontend should aggregate mappings from selected options and send them to `POST /api/recommend`.

Recommended payload contract (Stage 2):
- required mapped lists: `liked_keywords`, `disliked_keywords`, `liked_platforms`, `disliked_platforms`
- raw questionnaire blob: `questionnaire_raw` (preferred)
- legacy compatibility: `questionnaire` is still accepted

## Notes

- Keep question count between 8 and 12 for completion rate.
- Use canonical production keyword/platform IDs from your catalog and set `id_catalog` to identify the source snapshot.
- Update `version` when making backward-incompatible changes.
