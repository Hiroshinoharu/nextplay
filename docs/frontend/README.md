# NextPlay Frontend

React 19 + TypeScript + Vite frontend for the NextPlay game discovery and recommendation UI.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

## Local Development

- `npm run dev` starts the Vite dev server on `http://127.0.0.1:5174`.
- The Vite proxy forwards `/api` requests to `http://127.0.0.1:18084`.
- To target a different backend, set `VITE_API_URL` in `frontend/.env.local`.

Example:

```bash
VITE_API_URL=http://127.0.0.1:18084/api
```

## Styling

The frontend uses route-level CSS files plus `styled-components` for reusable interactive components. Tailwind is not part of the current build.

## Docker Compose

The containerized frontend is served by Nginx and is exposed at `http://localhost:5173` by default when you run the stack with `docker compose -f deploy/docker-compose.yml up -d --build` from the repo root.

If that port is already published, override it when you start Compose:

```bash
FRONTEND_HOST_PORT=5175 GATEWAY_HOST_PORT=18085 docker compose -f deploy/docker-compose.yml up -d --build
```
