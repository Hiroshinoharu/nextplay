# 🎮 NextPlay

**NextPlay** is a microservices-based video game recommender system currently under development.  
The system is designed to provide personalized game recommendations by combining a modular backend,  
a React-based frontend, and modern cloud-native deployment using Docker and Kubernetes.

---

## 🚀 Current Project Overview

- **Frontend:** React + TypeScript (Vite) with Tailwind CSS  
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
|`/frontend`| React frontend application this is where all my UI is displayed including the main user interface and interaction components with tailwind css|
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
Kubernetes manifests are provided in the `/deploy` directory to deploy all services to a local Docker Desktop Kubernetes cluster. Each service has its own deployment and service definition.

## Steps to Run the application Locally
1. Ensure Docker and Kubernetes are installed and running on your machine.
2. env file setup: Create `.env` files in the `/deploy/env` directory for each service with necessary environment variables.
   ```bash
   # Example for game service
   TOUCH /deploy/env/game.env
   # Add necessary environment variables in the file
    DATABASE_URL=postgres://nextplay:nextplay@postgres:5432/nextplay?sslmode=disable
    PORT=8081
    IGDB_CLIENT_ID= your_igdb_client_id
    IGDB_ACCESS_TOKEN=your_igdb_access_token
   ```
   ``` bash
   # Example for recommender service
    TOUCH /deploy/env/recommender.env
    # Add necessary environment variables in the file
    DATABASE_URL=postgres://nextplay:nextplay@postgres:5432/nextplay?sslmode=disable
    PORT=8082
    ```
    ``` bash
   # Example for user service
    TOUCH /deploy/env/user.env
    # Add necessary environment variables in the file
    DATABASE_URL=postgres://nextplay:nextplay@postgres:5432/nextplay?sslmode=disable
    PORT=8083
   ```
   ``` bash
    # Example for gateway service
     TOUCH /deploy/env/gateway.env
     # Add necessary environment variables in the file
     PORT=8084
     GAME_SERVICE_URL=http://game-service:8081
     RECOMMENDER_SERVICE_URL=http://recommender-service:8082
     USER_SERVICE_URL=http://user-service:8083
    ```
    ``` bash
   # Example for frontend service
    TOUCH /deploy/env/frontend.env
    # Add necessary environment variables in the file
    VITE_API_GATEWAY_URL=http://localhost:8084
   ```
   ``` bash
    # Example for Database service
     TOUCH /deploy/env/db.env
     # Add necessary environment variables in the file
     There are no specific environment variables needed for the database in this setup.
    ```
3. Clone the repository:
   ```bash
   git clone https://github.com/Hiroshinoharu/nextplay.git
   cd nextplay
   ```
4. Change to the deploy directory:
   ```bash
   cd deploy
   ```
5. Compose the Docker-compose.yml to set up the bridge network and services:
   ```bash
   docker-compose up -d
   ```
6. To do API endpoint testing, you can use tools like Postman or curl to interact with the services via the API Gateway.
7. Access the frontend application by navigating to `http://localhost:80` in your web browser.
8. To see each endpoint health status, you can send a GET request to `/health` on each service's exposed port.
   ```bash
   curl http://localhost:<service-port>/health
   ```
   This should return a simple health status response from each microservice.
   ```json
   {
     "service": "game",
     "status": "healthy"
   }
9.  To stop the services, run:
   ```bash
   docker-compose down
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

