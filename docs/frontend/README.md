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

## Railway Deployment

- Deploy the frontend with [frontend/Dockerfile](../../frontend/Dockerfile).
- Keep `VITE_API_URL=/api` so browser requests stay same-origin.
- Set `GATEWAY_UPSTREAM_URL` on the Railway `frontend` service to `http://${{gateway.RAILWAY_PRIVATE_DOMAIN}}:8084`.
- Give the `frontend` service the only public domain.
- Keep `gateway`, `user`, `game`, `recommender`, and `postgres` private inside the Railway project.

This uses the templated Nginx proxy in [frontend/nginx.conf](../../frontend/nginx.conf) so the frontend can forward `/api/*` traffic to the internal gateway without exposing the gateway publicly.

## Vercel Deployment

Vercel remains optional, but it is no longer required for the default hosted layout.

- Set the Vercel project root directory to `frontend/`.
- Keep `VITE_API_URL=/api` so browser requests stay same-origin on Vercel.
- Set `NEXTPLAY_GATEWAY_URL` to the deployed gateway origin, for example `https://gateway.example.com`.
- The checked-in [`vercel.json`](../../frontend/vercel.json) rewrites SPA routes to `index.html`.
- The checked-in [`api/[...path].js`](../../frontend/api/[...path].js) proxies `/api/*` requests from the Vercel app to `NEXTPLAY_GATEWAY_URL`, which preserves the existing cookie and CSRF flow.

## Styling

The frontend uses route-level CSS files plus `styled-components` for reusable interactive components. Tailwind is not part of the current build.

## Docker Compose

The containerized frontend is served by Nginx and is exposed at `http://localhost:5173` by default when you run the stack with `docker compose --env-file .env -f deploy/docker-compose.yml up -d --build` from the repo root.

If that port is already published, override it when you start Compose:

```bash
FRONTEND_HOST_PORT=5175 GATEWAY_HOST_PORT=18085 docker compose --env-file .env -f deploy/docker-compose.yml up -d --build
```