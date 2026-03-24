Place the active recommender serving artifacts in this folder.

Required files:
- `model.keras`
- `artifact_manifest.json`

The default recommender Docker image copies this folder into the container at:
- `/models/recommender/current/model.keras`
- `/models/recommender/current/artifact_manifest.json`
- `/models/recommender/current/candidate_index_map.json`
- `/models/recommender/current/popularity_prior.json`

That means the default Railway or Docker deploy can run in model mode without a separate storage mount, as long as these files stay in this folder at build time.

With `MODEL_REQUIRED=true`, the recommender service will fail startup if these files are missing or invalid.
