# Gateway API Inventory

This document inventories the API surface exposed by the NextPlay gateway service in `services/gateway/`.

## Scope

- Gateway service: `services/gateway`
- Base API prefix: `/api`
- Standalone liveness route: `/health`

The gateway is an internal Go/Fiber service in this repository. This repo does not currently contain an AWS API Gateway, OpenAPI, or Swagger definition for it.

## Downstream Services

The gateway proxies requests to these backend services:

- User service
- Game service
- Recommender service

## Cross-Cutting Behavior

- CORS is enabled for configured frontend origins and allows credentials.
- All `/api` routes pass through CSRF middleware.
- CSRF enforcement applies to unsafe browser requests that use the session cookie.
- JWT-protected routes accept either `Authorization: Bearer <token>` or the gateway session cookie.
- Same-user enforcement applies to protected routes with `:id` path params under user routes and user recommendation routes.
- Internal write routes for game administration use `X-Service-Token`.
- Auth-sensitive endpoints are rate-limited.

## Route Inventory

### Top-Level Health

| Section | Method | Path | Access | Purpose |
| --- | --- | --- | --- | --- |
| Health | `GET` | `/health` | Public | Gateway liveness check |

### `/api/health`

| Section | Method | Path | Access | Purpose |
| --- | --- | --- | --- | --- |
| Health | `GET` | `/api/health` | Public | Aggregated health across gateway, user, game, and recommender |
| Health | `GET` | `/api/health/gateway` | Public | Gateway health |
| Health | `GET` | `/api/health/user` | Public | User service health proxy |
| Health | `GET` | `/api/health/game` | Public | Game service health proxy |
| Health | `GET` | `/api/health/recommender` | Public | Recommender service health proxy |

### `/api/users`

| Section | Method | Path | Access | Purpose |
| --- | --- | --- | --- | --- |
| Users | `GET` | `/api/users/availability` | Public, rate-limited | Username/email availability check |
| Users | `GET` | `/api/users/csrf` | Public | Returns or refreshes CSRF token |
| Users | `POST` | `/api/users/register` | Public, rate-limited | Register user and issue session cookie |
| Users | `POST` | `/api/users/login` | Public, rate-limited | Login user and issue session cookie |
| Users | `POST` | `/api/users/logout` | Public | Clear session and CSRF cookies |
| Users | `GET` | `/api/users/:id` | JWT, same-user | Fetch a user by id |
| Users | `PUT` | `/api/users/:id` | JWT, same-user | Update a user |
| Users | `PATCH` | `/api/users/:id/password` | JWT, same-user, rate-limited | Change password |
| Users | `DELETE` | `/api/users/:id` | JWT, same-user | Delete user |
| Users | `GET` | `/api/users/:id/interactions` | JWT, same-user | List user interactions |
| Users | `POST` | `/api/users/:id/interactions` | JWT, same-user | Create user interaction |
| Users | `DELETE` | `/api/users/:id/interactions/:gameId` | JWT, same-user | Delete user interaction for a game |
| Users | `GET` | `/api/users/:id/interactions/events` | JWT, same-user | List user interaction events |
| Users | `POST` | `/api/users/:id/interactions/events` | JWT, same-user | Create user interaction event |

### `/api/games`

| Section | Method | Path | Access | Purpose |
| --- | --- | --- | --- | --- |
| Games | `GET` | `/api/games/popular` | Public | Popular landing-page games |
| Games | `GET` | `/api/games` | JWT | List games |
| Games | `GET` | `/api/games/search` | JWT | Search games |
| Games | `GET` | `/api/games/top` | JWT | Top games |
| Games | `GET` | `/api/games/questionnaire-facets` | JWT | Questionnaire facet options |
| Games | `GET` | `/api/games/:id` | JWT | Fetch game by id |
| Games | `GET` | `/api/games/:id/related-content` | JWT | Related add-on content for a game |
| Games | `GET` | `/api/games/:id/additional-content` | JWT | Additional content for a game |
| Games | `POST` | `/api/games` | Service token | Create game |
| Games | `PUT` | `/api/games/:id` | Service token | Update game |
| Games | `DELETE` | `/api/games/:id` | Service token | Delete game |
| Games | `GET` | `/api/games/:id/platforms` | JWT | List game platforms |
| Games | `POST` | `/api/games/:id/platforms` | Service token | Attach platform to game |
| Games | `DELETE` | `/api/games/:id/platforms/:platformId` | Service token | Remove platform from game |
| Games | `GET` | `/api/games/:id/keywords` | JWT | List game keywords |
| Games | `POST` | `/api/games/:id/keywords` | Service token | Attach keyword to game |
| Games | `DELETE` | `/api/games/:id/keywords/:keywordId` | Service token | Remove keyword from game |
| Games | `GET` | `/api/games/:id/companies` | JWT | List game companies |
| Games | `POST` | `/api/games/:id/companies` | Service token | Attach company to game |
| Games | `DELETE` | `/api/games/:id/companies/:companyId` | Service token | Remove company from game |
| Games | `GET` | `/api/games/:id/franchise` | JWT | List game franchises |
| Games | `POST` | `/api/games/:id/franchise` | Service token | Attach franchise to game |
| Games | `DELETE` | `/api/games/:id/franchise/:franchiseId` | Service token | Remove franchise from game |
| Games | `GET` | `/api/games/:id/series` | JWT | List game series |
| Games | `POST` | `/api/games/:id/series` | Service token | Attach series to game |
| Games | `DELETE` | `/api/games/:id/series/:seriesId` | Service token | Remove series from game |

### `/api/recommend`

| Section | Method | Path | Access | Purpose |
| --- | --- | --- | --- | --- |
| Recommend | `POST` | `/api/recommend` | JWT | Recommend from questionnaire or feature payload |
| Recommend | `GET` | `/api/recommend/user/:id` | JWT, same-user | Fetch recommendations for a user |
| Recommend | `GET` | `/api/recommend/item/:id` | JWT | Fetch item-to-item recommendations |
| Recommend | `POST` | `/api/recommend/item` | JWT | Fetch similar items from an item payload |

## Access Summary

- Public routes: top-level health, `/api/health/*`, `/api/users/availability`, `/api/users/csrf`, `/api/users/register`, `/api/users/login`, `/api/users/logout`, `/api/games/popular`
- JWT routes: protected user reads/writes, most game reads, all recommender routes
- Same-user routes: `/api/users/:id*`, `/api/recommend/user/:id`
- Service-token routes: game write and relationship mutation endpoints

## Rate Limits

Default gateway limits:

- Auth routes: `10` requests per `60` seconds
- Availability route: `30` requests per `60` seconds

These can be overridden with:

- `AUTH_RATE_LIMIT_MAX`
- `AUTH_RATE_LIMIT_WINDOW_SECONDS`
- `AUTH_AVAILABILITY_RATE_LIMIT_MAX`
- `AUTH_AVAILABILITY_RATE_LIMIT_WINDOW_SECONDS`

## Source of Truth

The current route and middleware behavior comes from:

- `services/gateway/routes/routes.go`
- `services/gateway/main.go`
- `services/gateway/middlewares/csrf.go`
- `services/gateway/middlewares/jwt.go`
- `services/gateway/middlewares/service_auth.go`
- `services/gateway/middlewares/rate_limit.go`
