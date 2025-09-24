# Tasks: Eve Data Browser Phase-1

## Conventions
- IDs use `M#-T##` to map directly to milestones in `plan.md`.
- Each task includes a Definition of Done (DoD) aligned with `specify.md` sections.
- Reference sections: Spec (§Ingestion Workflow, §Database Schema, §API Specification, §Entity Card JSON Contracts, §Frontend Experience, §Non-Functional Requirements).

## Milestone M0 — Repo Readiness
- [ ] **M0-T01** Scaffold Docker compose stack (`docker/compose.yml`).
  - **DoD**: Services `db`, `ingestion`, `backend`, `frontend` start; Postgres volume named `pg-data`; shared `data-sde` volume mounted.
- [ ] **M0-T02** Create multi-stage Dockerfiles (`docker/Dockerfile.ingestion`, `docker/Dockerfile.backend`, `docker/Dockerfile.frontend`).
  - **DoD**: Local `docker compose build` succeeds; dev commands mount source for hot reload.
- [ ] **M0-T03** Stub FastAPI backend with `/health` endpoint (`backend/app/main.py`).
  - **DoD**: `curl http://localhost:8080/health` returns `{ "status": "ok" }` while services running.
- [ ] **M0-T04** Initialise React + Vite app with filament background placeholder (`frontend/src`).
  - **DoD**: `npm run dev` inside container serves page showing sidebar scaffold + placeholder content.
- [ ] **M0-T05** Configure lint/format tooling (ruff, black, isort, eslint, prettier) with shared scripts.
  - **DoD**: `docker compose run --rm backend make lint` and `docker compose run --rm frontend npm run lint` exit 0.

## Milestone M1 — Ingestion Foundation
- [ ] **M1-T01** Implement filesystem watcher / poller for `data/SDE/_downloads/` (`ingestion/src/watcher.py`).
  - **DoD**: Detects newly dropped ZIP/YAML, enqueues path once, logs detection.
- [ ] **M1-T02** Implement checksum + version detection (`ingestion/src/utils/checksum.py`).
  - **DoD**: Unit tests cover identical archive skip + mismatch abort (fixtures under `ingestion/tests`).
- [ ] **M1-T03** Parse SDE YAML for ships + blueprints (`ingestion/src/parsers/sde_parser.py`).
  - **DoD**: Returns dicts for `invTypes`, `invBlueprintTypes`, activities, materials, products as per `specify.md` schema.
- [ ] **M1-T04** Create database migrations for minimal schema (`backend/db/migrations/001_init.py`).
  - **DoD**: Tables (`sde_versions`, `invTypes`, `invGroups`, `invCategories`, `invBlueprintTypes`, `industryActivity`, `industryActivityMaterials`, `industryActivityProducts`, `typeAttributes`) exist; Alembic revision tested via `alembic upgrade head` in container.
- [ ] **M1-T05** Build ingestion pipeline orchestrator + CLI (`ingestion/ingest_sde.py`).
  - **DoD**: `python ingest_sde.py --input data/SDE/_downloads/sample.zip` ingests sample fixture, populates tables, records `sde_versions`, writes JSON derivatives; logs include inserted/updated counts.
- [ ] **M1-T06** Add ingestion unit tests for missing assets & checksum mismatch (`ingestion/tests/test_ingest_failures.py`).
  - **DoD**: Tests fail before implementation, pass after; ensure pipeline aborts cleanly with prior manifest intact.
- [ ] **M1-T07** Implement fallback for CCP page changes (`ingestion/src/config.py`, `ingestion/tests/test_fallback.py`).
  - **DoD**: Configurable base URL + mirror list; CLI switches to mirror when primary discovery fails; logs actionable warning and blocks until manual file provided; tests cover fallback path.

## Milestone M2 — API Delivery
- [ ] **M2-T01** Publish Ship & Blueprint entity card JSON contracts (`backend/contracts/entities.json`).
  - **DoD**: JSON file committed with exact shapes from `specify.md`; referenced by backend and frontend.
- [ ] **M2-T02** Define Pydantic schemas matching contracts (`backend/app/schemas.py`).
  - **DoD**: Schemas validated against contract examples via tests.
- [ ] **M2-T03** Implement `/search` endpoint (`backend/app/routers/search.py`).
  - **DoD**: Supports entity switch, pagination, fuzzy name match; contract tests verifying payload & headers pass.
- [ ] **M2-T04** Implement `/ships/{type_id}` endpoint (`backend/app/routers/ships.py`).
  - **DoD**: Returns Ship Card schema, 404 on invalid type; manifest headers included; contract test green.
- [ ] **M2-T05** Implement `/blueprints/{blueprint_type_id}` endpoint (`backend/app/routers/blueprints.py`).
  - **DoD**: Returns Blueprint Card schema; includes activities/materials/time arrays; tests green.
- [ ] **M2-T06** Add DB indexes & query helpers (`backend/app/repositories/sde_repository.py`).
  - **DoD**: Lowercase name indexes exist; explain analyze shows index usage for search queries.
- [ ] **M2-T07** Integrate structured logging + error handling middleware (`backend/app/middleware/logging.py`).
  - **DoD**: Logs include request id, manifest version; errors return JSON described in spec.

## Milestone M3 — UI Browsers
- [ ] **M3-T01** Implement React sidebar navigation (Ships/Blueprints) with router state (`frontend/src/components/Sidebar.tsx`).
  - **DoD**: Clicking entries updates `?entity=` parameter and active styling.
- [ ] **M3-T02** Build shared search + pagination controls (`frontend/src/components/SearchBar.tsx`).
  - **DoD**: Debounced input updates query params; paginates results.
- [ ] **M3-T03** Implement TanStack Query data hooks for search/results (`frontend/src/hooks/useSearch.ts`).
  - **DoD**: Handles loading/error states; caches by `entity+query+page`.
- [ ] **M3-T04** Render virtualized results list with manifest badge (`frontend/src/components/ResultList.tsx`).
  - **DoD**: Shows name, group/product, manifest version; uses React-virtualized (or similar) to handle large lists.
- [ ] **M3-T05** Implement Ship Card component using contract (`frontend/src/components/cards/ShipCard.tsx`).
  - **DoD**: Displays all fields listed in `specify.md`; includes reduced-motion friendly animations.
- [ ] **M3-T06** Implement Blueprint Card component using contract (`frontend/src/components/cards/BlueprintCard.tsx`).
  - **DoD**: Renders activities, materials, outputs; quantities formatted.
- [ ] **M3-T07** Add filters (Ships: race/faction/group; Blueprints: product category, activity) (`frontend/src/components/Filters.tsx`).
  - **DoD**: Filter state synced to query params; API called with proper params.
- [ ] **M3-T08** Integrate filament background + reduced-motion toggle (`frontend/src/components/BackgroundWeb.tsx`, `frontend/src/components/SettingsToggle.tsx`).
  - **DoD**: Toggle disables animation; respects `prefers-reduced-motion` media query.
- [ ] **M3-T09** Frontend tests & accessibility audits (`frontend/tests/...`).
  - **DoD**: Vitest suites for cards/filters pass; Axe accessibility check shows no critical violations; keyboard traversal verified.

## Milestone M4 — Polish
- [ ] **M4-T01** Implement loading skeletons and empty/error states (`frontend/src/components/states/*`).
  - **DoD**: Search displays skeleton while fetching; empty & error messages follow design copy.
- [ ] **M4-T02** Add toast notifications for ingestion/API errors (`frontend/src/components/ToastProvider.tsx`).
  - **DoD**: 500 responses surface toast with retry option.
- [ ] **M4-T03** Update README quickstart with Docker commands, ingest CLI, sample queries, screenshots (`README.md`).
  - **DoD**: Steps verified end-to-end; includes link to contracts and UI screenshots.
- [ ] **M4-T04** Capture & store UI screenshots (`docs/screenshots/ships.png`, `docs/screenshots/blueprints.png`).
  - **DoD**: Images generated after ingest; referenced in README/tasks.
- [ ] **M4-T05** Refine logging + metrics names (`backend/app/metrics.py`).
  - **DoD**: Expose basic Prometheus counters for ingestion runs, search queries; docs updated.

## Milestone M5 — Ops Hardening
- [ ] **M5-T01** Create Postgres volume backup/restore scripts (`scripts/backup_db.sh`, `scripts/restore_db.sh`).
  - **DoD**: Scripts documented; test restore verifies data integrity after backup cycle.
- [ ] **M5-T02** Implement SDE archive pruning job (`ingestion/src/prune_archives.py`).
  - **DoD**: Retains latest N manifests, archives older ones; dry-run mode available.
- [ ] **M5-T03** Document performance benchmarking (`docs/performance.md`).
  - **DoD**: Includes ingestion duration, top query latencies, hardware context.
- [ ] **M5-T04** Configure CI pipeline (GitHub Actions) running lint + unit tests (`.github/workflows/ci.yml`).
  - **DoD**: Pipeline executes ruff/black, pytest, FastAPI contract tests, frontend lint/test on pull requests.
- [ ] **M5-T05** Publish entity card contracts as build artifact (`backend/contracts/entities.json`).
  - **DoD**: CI uploads JSON contract file; tasks document download location for frontend consumers.

## Definition of Done Checklist
- [ ] Latest SDE ingested, `sde_versions` reflects version + checksum.
- [ ] FastAPI endpoints return documented JSON contracts and manifest headers.
- [ ] React UI delivers filament-themed browsers for Ships and Blueprints with accessible interactions.
- [ ] CI pipeline enforces lint/tests; README quickstart validated.
- [ ] Backup/pruning workflows tested; performance note published.
