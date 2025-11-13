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

## 📁 Directory Structure

```bash
nextplay/
├── frontend/             # React + Tailwind frontend (Vite)
├── services/
│   ├── gateway/          # API gateway (routes requests between microservices)
│   ├── user/             # Handles user data & preferences
│   ├── game/             # Fetches game data (IGDB API integration planned)
│   └── recommender/      # Machine learning model service (FastAPI)
├── docker-compose.yml    # Local deployment file for multi-container setup
├── kube                # Kubernetes manifests (Deployments & Services)
├── .gitignore            # Ignored files (node_modules, build artifacts, etc.)
└── README.md             # Project documentation