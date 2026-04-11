# NextPlay Testing Overview

This document is a working summary of the testing and validation approaches currently evidenced in the NextPlay repository. It is intended to help with project reports, implementation notes, and future testing plans.

## Purpose

Use this document when you need to:

- describe the types of testing already used in the project;
- reuse accurate report wording without overstating coverage;
- distinguish between confirmed testing practices and testing types that are not yet evidenced in the repo.

## Confirmed Testing Types

### 1. Smoke Testing

Smoke testing is present in lightweight checks that confirm the system or a critical pipeline still starts and produces expected artifacts.

Current examples:

- frontend production build verification after major UI edits;
- recommender service import validation in CI;
- recommender retrain smoke in CI using seeded fixture data.

Evidence:

- [`docs/2026-03-10-session-summary.md`](./2026-03-10-session-summary.md)
- [`frontend/package.json`](../frontend/package.json)
- [`ci.yml`](../.github/workflows/ci.yml)

Suggested report wording:

> Smoke tests were used to verify that critical application paths still built, loaded, and produced expected artifacts after changes.

### 2. Unit Testing

Unit tests are used across frontend, Go services, and recommender modules to validate isolated logic and edge cases.

Current examples:

- password policy checks in the user service;
- middleware behavior such as JWT, CSRF, rate limiting, and service auth;
- recommender model configuration, model loading, schema handling, and helper logic.

Evidence:

- [`services/user/auth/password_policy_test.go`](../services/user/auth/password_policy_test.go)
- [`services/gateway/middlewares/jwt_test.go`](../services/gateway/middlewares/jwt_test.go)
- [`services/recommender/tests/test_model_loader.py`](../services/recommender/tests/test_model_loader.py)

Suggested report wording:

> Unit tests were used to validate isolated backend, frontend, and ML-serving logic, including validation rules, authentication helpers, and model-loading behavior.

### 3. Component and UI Testing

Frontend components are tested using Vitest with a jsdom environment to verify rendering and interaction behavior.

Current examples:

- search bar submission and input handling;
- navbar rendering behavior;
- form interactions;
- screenshot gallery and lightbox interactions.

Evidence:

- [`frontend/tests/Searchbar.ui.test.tsx`](../frontend/tests/Searchbar.ui.test.tsx)
- [`frontend/tests/Navbar.ui.test.tsx`](../frontend/tests/Navbar.ui.test.tsx)
- [`frontend/tests/Form.ui.test.tsx`](../frontend/tests/Form.ui.test.tsx)
- [`frontend/tests/Lightbox.ui.test.tsx`](../frontend/tests/Lightbox.ui.test.tsx)

Suggested report wording:

> Component-level UI tests were used to verify frontend rendering and user interactions in key reusable interface elements.

### 4. API and Service Integration Testing

Integration-style tests are used to exercise routes, request handling, cookies, authentication forwarding, and service interactions through framework test clients.

Current examples:

- gateway route forwarding and cookie-backed auth behavior;
- recommender route behavior using FastAPI `TestClient`;
- user and game handler request/response validation.

Evidence:

- [`services/gateway/routes/routes_test.go`](../services/gateway/routes/routes_test.go)
- [`services/recommender/tests/test_recommend_routes.py`](../services/recommender/tests/test_recommend_routes.py)
- [`services/user/handlers/auth_test.go`](../services/user/handlers/auth_test.go)
- [`services/game/handlers/games_test.go`](../services/game/handlers/games_test.go)

Suggested report wording:

> Integration testing was used to verify API routes, request validation, authentication handling, and service-to-service interactions.

### 5. Regression Testing

Regression testing is evidenced through checks designed to confirm that previously working behaviors still respond correctly after implementation changes.

Current examples:

- recommender offline evaluation gate checks for pass/fail behavior;
- route tests that preserve existing endpoint responses and forwarding behavior;
- repeated frontend rebuild validation after UI changes.

Evidence:

- [`services/recommender/tests/training/test_offline_eval.py`](../services/recommender/tests/training/test_offline_eval.py)
- [`services/recommender/tests/test_recommend_routes.py`](../services/recommender/tests/test_recommend_routes.py)
- [`docs/2026-03-10-session-summary.md`](./2026-03-10-session-summary.md)

Suggested report wording:

> Regression testing was used to ensure that route behavior, recommendation outputs, and frontend build stability were preserved after updates.

### 6. Negative and Edge-Case Testing

The project includes tests that intentionally submit invalid or incomplete inputs to verify error handling.

Current examples:

- malformed JSON payloads;
- invalid route parameters;
- missing required query parameters;
- invalid email and invalid user ID handling.

Evidence:

- [`services/game/handlers/games_test.go`](../services/game/handlers/games_test.go)
- [`services/user/handlers/auth_test.go`](../services/user/handlers/auth_test.go)
- [`services/recommender/tests/test_recommend_routes.py`](../services/recommender/tests/test_recommend_routes.py)

Suggested report wording:

> Negative testing was used to validate robust error handling for malformed requests, invalid identifiers, and incomplete input data.

### 7. Security and Authentication Testing

Security-sensitive paths are explicitly tested in the gateway and user services.

Current examples:

- JWT validation and session handling;
- CSRF token enforcement;
- service-to-service token checks;
- password policy enforcement;
- rate-limiting behavior.

Evidence:

- [`services/gateway/middlewares/csrf_test.go`](../services/gateway/middlewares/csrf_test.go)
- [`services/gateway/middlewares/rate_limit_test.go`](../services/gateway/middlewares/rate_limit_test.go)
- [`services/gateway/middlewares/service_auth_test.go`](../services/gateway/middlewares/service_auth_test.go)
- [`services/user/auth/password_policy_test.go`](../services/user/auth/password_policy_test.go)

Suggested report wording:

> Security-focused testing was carried out for authentication, authorization, CSRF protection, and rate-limiting controls.

### 8. Contract Testing

The recommender pipeline includes contract-style testing to ensure training and inference use compatible feature representations.

Current examples:

- parity checks between training feature generation and inference feature generation;
- schema-version consistency checks.

Evidence:

- [`services/recommender/tests/training/test_feature_pipeline_contract.py`](../services/recommender/tests/training/test_feature_pipeline_contract.py)

Suggested report wording:

> Contract testing was used to ensure consistency between training-time and inference-time feature pipelines in the recommender system.

### 9. Data Quality and Dataset Validation Testing

The recommender training workflow includes checks that validate whether datasets are suitable for training and evaluation.

Current examples:

- minimum row and class-balance thresholds;
- user/game coverage checks;
- validation/test split quality checks;
- degenerate evaluation split detection.

Evidence:

- [`services/recommender/tests/training/test_dataset_pipeline.py`](../services/recommender/tests/training/test_dataset_pipeline.py)
- [`services/recommender/tests/training/test_launch_validation_policy.py`](../services/recommender/tests/training/test_launch_validation_policy.py)

Suggested report wording:

> Dataset validation checks were used to verify that recommender training data met minimum coverage, quality, and split-health requirements before promotion decisions.

### 10. ML Offline Evaluation

The recommender system is evaluated using offline ranking metrics rather than live online experiments.

Current examples:

- Recall@K;
- NDCG@K;
- MAP@K;
- coverage at K;
- list diversity at K.

Evidence:

- [`services/recommender/tests/training/test_offline_eval.py`](../services/recommender/tests/training/test_offline_eval.py)
- [`services/recommender/training/runs/2026-03-11/run_log.json`](../services/recommender/training/runs/2026-03-11/run_log.json)
- [`services/recommender/training/runs/20260311T151011Z/run_log.json`](../services/recommender/training/runs/20260311T151011Z/run_log.json)
- [`services/recommender/training/runs/20260316T111656Z/run_log.json`](../services/recommender/training/runs/20260316T111656Z/run_log.json)

Suggested report wording:

> The recommender model was assessed using offline evaluation metrics, including Recall@K, NDCG@K, MAP@K, coverage, and diversity.

### 11. Baseline Comparison Testing for ML Models

The recommender evaluation pipeline compares the trained model against baseline ranking approaches.

Current examples:

- comparison against popularity baseline;
- comparison against rule-based fallback baseline.

Evidence:

- [`services/recommender/tests/training/test_offline_eval.py`](../services/recommender/tests/training/test_offline_eval.py)
- [`services/recommender/training/runs/20260316T111656Z/run_log.json`](../services/recommender/training/runs/20260316T111656Z/run_log.json)

Suggested report wording:

> Comparative ML testing was used to evaluate the trained recommendation model against popularity-based and fallback baseline strategies.

### 12. Reproducibility Testing

The training pipeline includes checks for deterministic behavior and reproducible logging.

Current examples:

- deterministic seeded interaction generation;
- reproducible random seeding;
- consistent hash logging for datasets, predictions, and training code;
- persisted run artifacts and TensorBoard logging.

Evidence:

- [`services/recommender/tests/training/test_dataset_pipeline.py`](../services/recommender/tests/training/test_dataset_pipeline.py)
- [`services/recommender/tests/training/test_retrain.py`](../services/recommender/tests/training/test_retrain.py)

Suggested report wording:

> Reproducibility testing was used to verify deterministic seeding, repeatable data generation, and traceable experiment artifacts.

### 13. Launch-Gate and Release-Readiness Testing

The recommender training flow includes explicit gating logic that decides whether a trained artifact is eligible for promotion.

Current examples:

- pass/fail gate decisions based on offline thresholds;
- critical-threshold enforcement;
- persisted launch gate decision artifacts;
- promotion only when launch conditions are satisfied.

Evidence:

- [`services/recommender/tests/training/test_launch_gate.py`](../services/recommender/tests/training/test_launch_gate.py)
- [`services/recommender/training/runs/20260316T111656Z/run_log.json`](../services/recommender/training/runs/20260316T111656Z/run_log.json)

Suggested report wording:

> Launch-gate validation was used to ensure that only recommender artifacts meeting defined quality thresholds were eligible for promotion.

### 14. Build Verification and CI Gate Testing

The project uses CI to enforce build and test gates across key parts of the system.

Current examples:

- service builds for gateway, game, and user;
- recommender import validation;
- recommender training tests and retrain smoke;
- frontend lint, test, and build gates.

Evidence:

- [`README.md`](../README.md)
- [`ci.yml`](../.github/workflows/ci.yml)

Suggested report wording:

> Continuous integration gates were used to verify service builds, frontend quality checks, and recommender validation workflows.

## Confirmed Historical Validation Outcomes

The repository also contains specific historical validation evidence that can be cited directly.

### Frontend Validation

- Repeated frontend `npm run build` validation was recorded after major UI changes on March 10, 2026.

Evidence:

- [`docs/2026-03-10-session-summary.md`](./2026-03-10-session-summary.md)

### Recommender Test Suite

- A recommender test-suite result of `62 passed` was recorded on March 10, 2026.

Evidence:

- [`docs/2026-03-10-session-summary.md`](./2026-03-10-session-summary.md)

### Recommender Retrain and Evaluation Runs

- March 10, 2026: training completed, but offline evaluation gate failed.
- March 11, 2026 at 14:07 UTC: training completed, but offline evaluation gate failed.
- March 11, 2026 at 15:10 UTC: training completed, but offline evaluation gate failed.
- March 16, 2026 at 11:28 UTC: dataset quality passed, offline evaluation passed, and artifact promotion succeeded.

Evidence:

- [`docs/2026-03-10-session-summary.md`](./2026-03-10-session-summary.md)
- [`services/recommender/training/runs/2026-03-11/run_log.json`](../services/recommender/training/runs/2026-03-11/run_log.json)
- [`services/recommender/training/runs/20260311T151011Z/run_log.json`](../services/recommender/training/runs/20260311T151011Z/run_log.json)
- [`services/recommender/training/runs/20260316T111656Z/run_log.json`](../services/recommender/training/runs/20260316T111656Z/run_log.json)

## Testing Types Not Currently Evidenced

The following testing categories should not be claimed unless separate evidence is added:

- A/B testing with live users;
- online experimentation;
- production canary analysis;
- browser end-to-end automation with tools such as Playwright or Cypress;
- load testing or formal performance benchmarking;
- penetration testing;
- chaos testing;
- usability studies with recorded participants.

Recommended wording if needed:

> The current project emphasizes automated functional, validation, and offline ML evaluation testing. Online experimentation and performance-focused testing remain future extensions rather than confirmed completed work.

## Short Report Version

If a short summary is needed, this wording is safe to reuse:

> The project used a combination of smoke testing, unit testing, component/UI testing, API integration testing, regression testing, negative testing, security testing, data-validation testing, ML offline evaluation, baseline comparison testing, reproducibility testing, and launch-gate validation. Continuous integration was also used to enforce build, test, and verification gates across the frontend and backend services.

