Place the active recommender serving artifacts in this folder.

Required files:
- `model.keras`
- `artifact_manifest.json`

These are mounted into the recommender container at:
- `/models/recommender/current/model.keras`
- `/models/recommender/current/artifact_manifest.json`

With `MODEL_REQUIRED=true`, the recommender service will fail startup if these files are missing or invalid.
