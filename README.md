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

This setup validates the overall architecture and deployment pipeline before adding full functionality such as database integration, IGDB API access, and ML-based recommendations.

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
`GET /health` - Health check endpoint

**Docker setup:** Dockerfile included for containerization.

**Status:** Basic structure in place, endpoints to be implemented.

### 📞 Recommender Service
**Purpose:** Handles recommendation logic and interfaces with the ML service.

**Endpoints Implemented:**
`GET /health` - Health check endpoint

**Docker setup:** Dockerfile included for containerization.

**Status:** Basic structure in place, endpoints to be implemented.

### 🧑 User Service
**Purpose:** Manages user data and authentication.

**Endpoints Implemented:**
`GET /health` - Health check endpoint

**Docker setup:** Dockerfile included for containerization.

**Status:** Basic structure in place, endpoints to be implemented.

### 🛡️ API Gateway
**Purpose:** Routes requests between frontend and backend microservices. The gateway handles incoming API requests and forwards them to the appropriate microservice it is done via REST calls.

**Endpoints Implemented:**
`GET /health` - Health check endpoint

**Docker setup:** Dockerfile included for containerization.

**Status:** Basic structure in place, routing logic to be implemented.

### 🖥️ Frontend Service
**Purpose:** Provides the user interface for interacting with the NextPlay system.

**Features Implemented:**
- Basic layout with Tailwind CSS
- Docker setup: Dockerfile included for containerization.
- Status: Basic UI structure in place, full functionality to be developed.

**Status:** Basic UI structure in place, full functionality to be developed.

## Current Implementation Status
- All microservices have basic health check endpoints implemented.
- Dockerfiles are provided for containerization of each service.
- Kubernetes manifests are set up for local deployment.
- Frontend has a basic layout but lacks full functionality.
- No database integration or IGDB API access yet.
- Machine learning service is not yet implemented.
- Comprehensive testing and CI/CD pipelines are in place and can be viewed on github actions.
- Monitoring, logging, and security features are not yet integrated.
- Scalability and load balancing configurations are not yet optimized.
- Documentation is limited; more detailed guides and API documentation are needed.
- Error handling and validation are minimal.
- Performance optimizations have not been addressed.

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
- Endpoints for each microservice are not fully implemented.
- No database integration; data persistence is not yet available.
- No integration with IGDB API for game data.
- Machine learning models for recommendations are not yet developed.
- Frontend lacks full user interaction features.
- Monitoring and logging solutions are not yet integrated.
- Security features such as authentication and authorization are not implemented.
- Scalability and load balancing configurations are not yet optimized.
- Documentation is limited; more detailed guides and API documentation are needed.
- Error handling and validation are minimal.
- Performance optimizations have not been addressed.
- No user analytics or tracking implemented.
- Localization and internationalization features are not included.
---
## 🚧 Future Work
- Implement full functioning endpoints for each microservice.
- Integrate with IGDB API for game data.
- Develop machine learning models for personalized recommendations.
- Add database integration for persistent storage.
- Enhance frontend with more user features and improved UI/UX.
- Implement comprehensive testing and CI/CD pipelines.
- Integrate monitoring and logging solutions for better observability.