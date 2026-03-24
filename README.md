# NextPlay

NextPlay is a game discovery and recommendation platform built as a small service-oriented system. The repo contains a React frontend, Go API services, and a Python recommender service, along with Docker Compose and Kubernetes assets for local and deployment-oriented workflows.

## Stack

- Frontend: React 19, TypeScript, Vite, styled-components
- Gateway: Go, Fiber
- Game service: Go, Fiber, PostgreSQL-backed catalog APIs
- User service: Go, Fiber, PostgreSQL-backed auth and profile APIs
- Recommender service: Python, FastAPI, Keras-based model serving with fallback logic
- Local infra: Docker Compose, PostgreSQL
- Deployment assets: Kubernetes manifests under `kube/`

## Repository Layout

| Path | Purpose |
| --- | --- |
| `frontend/` | React/Vite UI for discovery, auth, games, and recommendations |
| `services/gateway/` | Public API gateway and auth/proxy middleware |
| `services/game/` | Game catalog APIs, relationship APIs, and ETL entrypoint |
| `services/user/` | User auth, profile, and interaction APIs |
| `services/recommender/` | Recommendation API, training pipeline, and model artifacts |
| `services/shared/` | Shared config and observability helpers for Go services |
| `deploy/` | Docker Compose, config, migrations, and local infra files |
| `docs/` | Consolidated project documentation and moved service/frontend notes |
| `kube/` | Kubernetes base and overlay manifests |

Documentation index: [docs/README.md](docs/README.md)

## Architecture

![System Architecture](System%20Architecture.drawio.png)

## Service Map

| Component | Local URL | Notes |
| --- | --- | --- |
| Frontend (Docker) | `http://localhost:5173` by default | Nginx-served production build |
| Frontend (Vite dev) | `http://127.0.0.1:5174` | `npm run dev` in `frontend/` |
| Gateway | `http://localhost:18084` by default | Public API entrypoint |
| PostgreSQL | Compose network only by default | Reach it with `docker compose exec postgres psql ...` or use the PostgreSQL host override below when a GUI client needs TCP access |
| Internal services | Compose network only | User, game, and recommender are reachable through the gateway or from other containers |

## Current State

The repo is beyond the skeleton stage. The main flow already works end to end:

- the frontend can authenticate users, browse games, and submit questionnaire-driven recommendation requests;
- the gateway proxies authenticated user and game APIs and exposes aggregated health checks;
- the game and user services provide real CRUD and relationship endpoints backed by PostgreSQL;
- the recommender can load a trained `.keras` artifact and fall back to non-model ranking behavior when needed;
- CI runs Go builds/tests, recommender validation/training checks, and frontend lint/test/build gates.

The remaining work is mostly around product depth and operational hardening rather than basic wiring.

## Local Development

### Prerequisites

- Docker Desktop for the full local stack
- Node.js 20+ for frontend development
- Go 1.24.5 for local Go builds/tests
- Python 3.11 for recommender development and training tasks

### Run the Full Stack with Docker Compose

1. Copy `.env.example` to `.env` and replace every placeholder secret before starting the stack.
   - Compose still reads the non-secret defaults in `deploy/env/` for service URLs and tuning values.
2. Start the stack from the repo root:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build
```

If `5173` or `18084` is already published by the desktop bridge or another local stack, override the host ports:

```bash
FRONTEND_HOST_PORT=5175 GATEWAY_HOST_PORT=18085 docker compose --env-file .env -f deploy/docker-compose.yml up -d --build
```

3. Check the main endpoints:

```text
Frontend:     http://localhost:5173
Gateway:      http://localhost:18084/health
PostgreSQL:   internal only (`docker compose exec postgres psql -U nextplay -d nextplay`)
```

If you override the host ports, use those values in the URLs above.

To expose PostgreSQL to desktop clients such as DBeaver or pgAdmin:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.postgres-host.yml up -d --build
```

Then connect to `127.0.0.1:5432` with the database, username, and password from your repo-root `.env` file. Do not use `0.0.0.0` as the client host value.

If the stack is already running, recreate only PostgreSQL with the host binding:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.postgres-host.yml up -d --force-recreate --no-deps postgres
```

More detail: [docs/postgres-dbeaver-access.md](docs/postgres-dbeaver-access.md)

4. Check aggregated downstream health through the gateway:

```bash
curl http://localhost:18084/api/health/
curl http://localhost:18084/api/health/game
curl http://localhost:18084/api/health/user
curl http://localhost:18084/api/health/recommender
```

5. Stop the stack when finished:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml down
```

### Run the Game ETL Manually

The ETL service is configured as an optional Compose profile.

```bash
docker compose --env-file .env -f deploy/docker-compose.yml run --rm game-etl
```

### Run the Frontend Against the Local Gateway

If you want Vite instead of the Dockerized frontend:

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://127.0.0.1:5174` and proxies `/api` to `http://127.0.0.1:18084`.

To override the backend target, create `frontend/.env.local`:

```bash
VITE_API_URL=http://127.0.0.1:18084/api
```

### Deploy the Full Stack on Railway

The current recommended hosted layout is a single Railway project with five private backend services and one public frontend service.

- `frontend` is public and deploys from [frontend/Dockerfile](frontend/Dockerfile).
- `gateway`, `user`, `game`, `recommender`, and `postgres` stay private inside Railway.
- Set `GATEWAY_UPSTREAM_URL` on the Railway `frontend` service to `http://${{gateway.RAILWAY_PRIVATE_DOMAIN}}:8084`.
- Keep the production frontend setting `VITE_API_URL=/api`.
- The templated proxy in [frontend/nginx.conf](frontend/nginx.conf) forwards browser `/api/*` traffic to the private gateway, so the gateway does not need its own public domain.
- The recommender image now bakes in the current trained artifacts from [services/recommender/training/artifacts/current](services/recommender/training/artifacts/current), so Railway model mode does not need a separate mounted volume for the default deploy.

Recommended service order:

1. `postgres`
2. `user`
3. `game`
4. `recommender`
5. `gateway`
6. `frontend`

Recommended Railway variables for model-serving recommender deploys:

```text
PORT=8082
DATABASE_URL=${{postgres.DATABASE_URL}}
GATEWAY_SERVICE_TOKEN=replace-with-shared-service-token
USER_SERVICE_URL=http://user.railway.internal:8083
GAME_SERVICE_URL=http://game.railway.internal:8081
GATEWAY_SERVICE_URL=http://gateway.railway.internal:8084
MODEL_PATH=/models/recommender/current/model.keras
MODEL_MANIFEST_PATH=/models/recommender/current/artifact_manifest.json
MODEL_VERSION=20260313T164930Z
MODEL_REQUIRED=true
```

If you want fallback-only mode instead, override `MODEL_REQUIRED=false` on the Railway `recommender` service.

### Deploy the Frontend to Vercel

Vercel remains an optional alternative for the frontend only.

- Set the Vercel project Root Directory to `frontend/`.
- Use the default production frontend setting `VITE_API_URL=/api`.
- Set `NEXTPLAY_GATEWAY_URL` to the externally reachable gateway origin, such as `https://gateway.example.com`.
- The checked-in [frontend/vercel.json](frontend/vercel.json) preserves SPA deep links.
- The checked-in [frontend/api/[...path].js](frontend/api/[...path].js) proxies same-origin `/api/*` requests to the gateway so the existing session cookie and CSRF flow continue to work behind Vercel.

## API Notes

### User-facing gateway routes

The frontend should usually talk to the gateway under `/api`.

- Auth: `POST /api/users/register`, `POST /api/users/login`, `POST /api/users/logout`
- User profile: `/api/users/:id`
- User interactions: `/api/users/:id/interactions*`
- Games: `/api/games*`
- Recommendations: `/api/recommend*`
- Health: `/api/health*`

### Authentication

The gateway terminates browser auth and stores the JWT in an `HttpOnly` session cookie.

- `POST /api/users/register` and `POST /api/users/login` issue the session cookie.
- `GET /api/users/csrf` returns and refreshes the CSRF token used by browser clients.
- `POST /api/users/logout` clears the session cookie.
- Browser clients should use same-origin requests or `credentials: "include"`; they do not need to read or persist the JWT.
- Unsafe browser requests send `X-CSRF-Token` with the matching CSRF cookie to protect the session-backed flow.
- Non-browser clients can still send `Authorization: Bearer <token>` on protected gateway requests.
- The gateway also enforces same-user access on protected `/api/users/:id/...` routes.

### Internal write routes

Gateway write operations for game/admin-style flows use service-to-service auth.

- Send `X-Service-Token: <token>`
- Configure the expected token with `GATEWAY_SERVICE_TOKEN` or `SERVICE_TOKEN`

### Security defaults

- Docker Compose publishes only the frontend and gateway; PostgreSQL, user, game, and recommender stay on the internal Compose network by default.
- Internal game writes and recommender requests require `X-Service-Token` between services.
- Browser auth now uses an `HttpOnly` session cookie instead of browser-readable local storage.
- Unsafe session-cookie requests require a matching CSRF token header and cookie.
- Gateway CORS is allowlisted through `CORS_ALLOWED_ORIGINS` instead of `*`, with credentialed requests enabled for approved frontend origins.
- Auth-sensitive routes are rate-limited at the gateway.
- The frontend Nginx config sets baseline browser hardening headers and a restrictive CSP.

## Testing and Verification

### Frontend

```bash
cd frontend
npm install
npm run lint
npm run test
npm run build
```

### Go Services

```bash
cd services/gateway && go test ./...
cd services/game && go test ./...
cd services/user && go test ./...
```

### Recommender

Install dependencies first:

```bash
pip install -r services/recommender/requirements.txt
```

Then run the main training/evaluation checks used by CI:

```bash
pytest -q services/recommender/tests/training/test_offline_eval.py
pytest -q services/recommender/tests/training/test_retrain.py
pytest -q services/recommender/tests/training/test_dataset_pipeline.py
python -c "import sys; sys.path.append('services'); import recommender.main"
```

## CI

GitHub Actions runs the following in `.github/workflows/ci.yml`:

- `go build .` for `gateway`, `game`, and `user`
- recommender import validation and training-related pytest coverage
- frontend `npm run lint`
- frontend `npm run test`
- frontend `npm run build`

## Kubernetes

Kubernetes manifests live under `kube/base`, with desktop-oriented overlays under `kube/overlays/desktop`.

The checked-in bridge manifests expect a `nextplay-secrets` Kubernetes Secret; start from `deploy/bridge/base/nextplay-secrets.example.yaml` when provisioning one.
## Known Gaps

- catalog ingestion and freshness workflows still need more operational polish;
- recommendation quality work is ongoing around calibration, richer data, and rollout controls;
- observability, security hardening, and deployment operations still need expansion;
- the frontend needs more product depth beyond the current discovery and recommendation flow.



