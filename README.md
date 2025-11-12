# NextPlay 🎮

NextPlay is a microservices-based video game recommender system built with:
- Frontend: React + TypeScript (Vite)
- Backend: Go (Fiber)
- ML Service: Python (FastAPI)
- Deployment: Docker + Kubernetes

## Directory Structure
.
├── frontend/           # React + Tailwind frontend
├── services/
│   ├── gateway/        # API gateway (routes requests)
│   ├── user/           # Handles user data & preferences
│   ├── game/           # Fetches game data (IGDB API)
│   └── recommender/    # Machine learning model service
├── docker-compose.yml  # Local deployment
└── bridge/               # Kubernetes manifests (auto-generated)