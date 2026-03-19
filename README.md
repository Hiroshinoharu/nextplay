# 🎮 NextPlay

**NextPlay** is a microservices-based video game recommender system currently under development.  
The system is designed to provide personalized game recommendations by combining a modular backend,  
a React-based frontend, and modern cloud-native deployment using Docker and Kubernetes.

---

## 🚀 Current Project Overview

- **Frontend:** React + TypeScript (Vite) with route-level CSS and styled-components  
- **Backend Microservices:** Implemented in Go (Fiber framework)  
- **Machine Learning Service:** Python (FastAPI)  
- **Containerization:** Docker for each service  
- **Orchestration:** Kubernetes (Docker Desktop cluster)  

The repo now includes a working end-to-end recommendation flow: the frontend can submit questionnaire-driven recommendation requests through the gateway, the recommender can serve a trained `.keras` model artifact with fallback behavior, and the Go services expose authenticated user and game APIs for the UI. Database coverage, IGDB enrichment, and production hardening are still in progress.

---

## System Architecture

![System Architecture Diagram](<System Architecture.drawio.png>)

## 📁 Directory Structure

|Folder| Description|
|---|---|
|`/deploy`| Kubernetes deployment manifests for all services including frontend, backend microservices, and ML service. It aslo contains a intial SQL script to set up my tables|
|`/deploy/bridge`| Contains files to set up a Docker bridge network for local development and testing|
|`/deploy/env`| Environment variable files for different services to manage configuration settings This would include API keys, database URLs, and other sensitive information|
|`/frontend`| React frontend application where the user interface lives, built with page CSS, shared component styles, and Vite tooling.|
|`/kube`| Kubernetes configuration files for setting up the local cluster and services|
|`/services`| Contains all backend microservices and the ML service. Each service has its own folder with source code and Dockerfile.|
|`/services/game`| Backend microservice for game data management|
|`/services/recommender`| Backend microservice for handling recommendation logic|
|`/services/user`| Backend microservice for user management and authentication|
|`/services/gateway`| API gateway routing requests between microservices|

## Microservices Overview

### 🎮 Game Service
**Purpose:** Manages game data including fetching, storing, and updating game information.

**Endpoints Implemented:**
- `GET /health`
- `GET /games`, `GET /games/search`, `GET /games/popular`, `GET /games/top`, `GET /games/:id`, `GET /games/:id/related-content`
- Relationship endpoints for platforms, keywords, companies, franchise, and series
- Service-auth protected write routes for ETL/admin flows

**Docker setup:** Dockerfile included for containerization.

**Status:** Read-heavy game APIs and relationship management are implemented; IGDB-backed ingestion and broader catalog operations still need hardening.

### 📞 Recommender Service
**Purpose:** Handles recommendation logic and interfaces with the ML service.

**Endpoints Implemented:**
- `GET /health` - Health check endpoint
- `POST /recommend` - User recommendations with model-first inference and fallback support
- `GET /recommend/user/{user_id}` - User-specific recommendations
- `GET /recommend/item/{item_id}` - Similar-item recommendations
- `POST /recommend/item` - Similar-item recommendations with request body controls

**Docker setup:** Dockerfile included for containerization.

**Status:** Core recommendation endpoints, trained-model artifact loading, offline evaluation gates, and rule-based fallback behavior are implemented; threshold calibration and rollout operations still need hardening.

### 🧑 User Service
**Purpose:** Manages user data and authentication.

**Endpoints Implemented:**
- `GET /health`
- `POST /users/register`, `POST /users/login`
- Authenticated profile CRUD on `/users/:id`
- Authenticated interaction, keyword preference, and platform preference routes under `/users/:id/*`

**Docker setup:** Dockerfile included for containerization.

**Status:** JWT-based auth and user-preference APIs are implemented; broader account and product features still need expansion.

**Auth (JWT):**
- Set `JWT_SECRET` for the user service.
- `POST /users/login` and `POST /users/register` return a `token`.
- Pass `Authorization: Bearer <token>` for `/users/:id` and all `/users/:id/*` routes.

### 🛡️ API Gateway
**Purpose:** Routes requests between frontend and backend microservices.

**Endpoints Implemented:**
- `GET /health`
- Aggregated downstream health routes under `/api/health/*`
- Proxied user, game, and recommender routes under `/api/*`
- JWT enforcement for user-facing routes and service-token enforcement for internal write routes

**Docker setup:** Dockerfile included for containerization.

**Status:** Gateway routing, auth middleware, and proxy helpers are implemented; observability and production policy still need expansion.

### 🖥️ Frontend Service
**Purpose:** Provides the user interface for interacting with the NextPlay system.

**Features Implemented:**
- React/Vite UI for landing, login, user, game, games, and discover flows
- Questionnaire-driven recommendation requests against `/api/recommend`
- Authenticated fetches to gateway-backed user and game APIs
- Docker setup: Dockerfile included for containerization.

**Status:** The frontend supports the current discovery and recommendation flow; polish, content breadth, and additional product features remain.

## Current Implementation Status
- All microservices expose health endpoints, and the gateway also exposes aggregated downstream health checks.
- Game, user, and gateway services contain implemented authenticated API routes beyond service skeletons.
- Recommender service includes trained-model artifact loading, manifest validation, offline evaluation gates, and rule-based fallback execution.
- Dockerfiles are provided for containerization of each service, and deploy manifests are present for local stack startup.
- The frontend is wired to the gateway for login, game discovery, questionnaire capture, and recommendation rendering.
- No full IGDB-backed production catalog sync or complete product hardening yet.
- Current recommender limitations are operational rather than foundational: threshold calibration, richer training data, monitoring integrations, and launch operations still need to be finalized for sustained rollouts.
- Comprehensive testing and CI/CD pipelines are in place and can be viewed on GitHub Actions.
- Monitoring, logging, and security hardening are still incomplete.
- Scalability and load balancing configurations are not yet optimized.
- Documentation is still evolving, especially around deployment and API behavior.

## Kubernetes Deployment
Kustomize manifests live in `/kube/base`, with desktop-oriented overrides in `/kube/overlays/desktop`.

## Steps to Run the application Locally
1. Ensure Docker Desktop is running. Kubernetes is only required if you plan to apply the manifests in `/kube`.
2. Review the existing environment files in `/deploy/env` and update the machine-specific values you need. Docker Compose reads `game.env`, `gateway.env`, `recommender.env`, and `user.env` from that directory.
3. Start the local stack from the repo root:
   ```bash
   docker compose -f deploy/docker-compose.yml up -d --build
   ```
4. Open the local services:
   - Frontend: `http://localhost:5173`
   - Gateway health: `http://localhost:18084/health`
   - Recommender health: `http://localhost:18082/health`
   - Game health: `http://localhost:8081/health`
   - User health: `http://localhost:8083/health`
5. Check aggregated gateway health when you want downstream status through the public API:
   ```bash
   curl http://localhost:18084/api/health/game
   curl http://localhost:18084/api/health/user
   curl http://localhost:18084/api/health/recommender
   ```
6. If you run the frontend with Vite instead of Docker, set `VITE_API_URL=http://127.0.0.1:18084/api` in `frontend/.env.local` and use `npm run dev` inside `/frontend`.
7. Stop the stack:
   ```bash
   docker compose -f deploy/docker-compose.yml down
   ```
---

## Current Limitations
- Some product areas are still partial, but the main game, user, gateway, and recommender API surfaces are implemented.
- No complete production database/content pipeline or IGDB-backed catalog sync yet.
- Recommender ML capabilities exist (trained `.keras` artifacts, offline evaluation gates, reproducible retraining entrypoint, artifact/serving compatibility checks), but production calibration and launch operations still need completion.
- The frontend still needs more depth in account, social, and content-management interactions.
- Monitoring and logging solutions are not yet integrated end-to-end.
- Authentication and authorization exist for current JWT-protected routes, but security hardening is still incomplete.
- Scalability and load balancing configurations are not yet optimized.
- No user analytics or tracking implemented.
- Localization and internationalization features are not included.

## 🚧 Future Work
- Expand IGDB-backed ingestion and catalog freshness workflows.
- Improve recommendation quality with richer training data and calibrated rollout thresholds.
- Add more user-facing features on top of the existing authenticated API surface.
- Add database integration and stronger operational tooling.
- Integrate monitoring and logging solutions for better observability.

