# Tasks: CCP SDE ingestion bootstrap

**Input**: Design documents from `/specs/001-bootstrap-ingestion/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/
**Change Management**: Whenever this feature’s plan or spec changes, re-run `/tasks` (or extend this file) before implementation so new scope is covered.

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: ingestion scope, manifest expectations, API surface, UI requirements, observability notes
2. Load optional design documents:
   → data-model.md: Extract entities, ingestion run states, manifest schema → model tasks
   → contracts/: Each file → contract test + implementation task
   → research.md & quickstart.md: Extract decisions → setup, accessibility, Background Web, Docker tasks, provider rate limits
3. Generate tasks by category:
   → Setup: Docker compose, Postgres migrations, shared `data/sde/` volume, dependency installs
   → Tests: ingestion downloader/decompressor fixtures, dogma joins, blueprint activities, market ingestion, API contract tests, UI accessibility & reduced-motion tests
   → Core: ingestion pipelines, manifest writer, dogma/material joins, market adapters, DB migrations, FastAPI handlers, React views (filament cards, Background Web controls)
   → Integration: schedulers, metrics, health checks, container wiring, manifest exposure in responses, docs
   → Polish: additional tests, performance notes, review artifacts
4. Apply task rules:
   → Different files/services = mark [P] for parallel
   → Same file/service = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph covering ingestion → manifest → API → UI flow
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have migrations/models?
   → Manifest version propagated through API/UI?
   → Market ingestion + `/market/{type_id}` covered end-to-end?
   → UI flows have accessibility coverage?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files/services, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Ingestion worker**: `ingestion/src/`, `ingestion/tests/`
- **API (FastAPI)**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/tests/`
- **Docker & ops**: `docker/`, `.env.example`, `docs/`, `data/sde/`
- Adjust names if the plan defines an alternate structure (document the change)

## Phase 3.1: Setup
- [ ] T001 Create `docker/compose.yml` skeleton with services for Postgres, ingestion worker, FastAPI backend (uvicorn), frontend, and shared `data-sde` volume (`docker/compose.yml`).
- [ ] T002 Draft multi-stage Dockerfile for ingestion worker with Python runtime, dependency layer, and cache-friendly build (`docker/Dockerfile.ingestion`).
- [ ] T003 Draft multi-stage Dockerfile for FastAPI backend (Python 3.12 + uvicorn) including health probe defaults (`docker/Dockerfile.backend`).
- [ ] T004 Draft multi-stage Dockerfile for frontend build + dev server (`docker/Dockerfile.frontend`).
- [ ] T005 Scaffold `.env.example` with required variables (DATABASE_URL, REDIS_URL placeholder, SDE_BASE_URL, SDE_MANIFEST_PATH, ADAM4EVE_RATE_LIMIT_PER_MIN, MARKET_SNAPSHOT_WINDOW) (`.env.example`).
- [ ] T006 Configure shared Python project tooling for ingestion + backend (poetry/uv + `pyproject.toml`, `requirements.lock`, Makefile targets) (`pyproject.toml`, `Makefile`).
- [ ] T007 [P] Add linting/formatting/test configs (ruff, black, mypy, pytest) aligned with Docker images (`pyproject.toml`, `ruff.toml`, `mypy.ini`).
- [ ] T008 Seed `data/sde/` directory structure with `_downloads/.gitkeep`, placeholder manifest/type/blueprint JSON files, and README describing usage (`data/sde/`).

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
- [ ] T009 Define pytest fixture for CCP static data HTML snapshot + zipped YAML to drive downloader tests (`ingestion/tests/conftest.py`).
- [ ] T010 Write failing tests for downloader discovery, retry/backoff, resume support, and missing-asset failure handling using httpx mocking (`ingestion/tests/test_fetch_and_load.py`).
- [ ] T011 Write failing tests ensuring `.bz2` decompression → manifest SHA-256 recording → JSON derivative generation and checksum-mismatch aborts (`ingestion/tests/test_manifest_pipeline.py`).
- [ ] T012 Write failing tests for dogma attribute merging (typeDogma + dogmaAttributes + units) producing normalized ship stat payloads (`ingestion/tests/test_dogma_join.py`).
- [ ] T013 Write failing tests covering blueprint activities (materials/products/skills/probabilities) persisted via ingestion pipeline (`ingestion/tests/test_blueprint_pipeline.py`).
- [ ] T014 Write failing tests for Adam4EVE market adapter enforcing rate limits and incremental snapshots (`ingestion/tests/test_market_adapter.py`).
- [ ] T015 [P] Write failing FastAPI test for `/health` exposing manifest status + ingestion timestamp (`backend/tests/test_health.py`).
- [ ] T016 [P] Write failing FastAPI test for `/ships/{type_id}` returning manifest headers and dogma-derived stats (`backend/tests/test_ships.py`).
- [ ] T017 [P] Write failing FastAPI test for `/blueprints/{blueprint_type_id}` returning activities, skill requirements, invention metadata (`backend/tests/test_blueprints.py`).
- [ ] T018 [P] Write failing FastAPI test for `/market/{type_id}` returning 7/30-day series from Postgres snapshots with provider/window params (`backend/tests/test_market.py`).
- [ ] T019 [P] Write failing Vitest suite for Background Web reduced-motion toggle + manifest display badge in grid header (`frontend/tests/components/FilamentGrid.spec.tsx`).
- [ ] T020 [P] Write accessibility snapshot test verifying keyboard navigation and focus states with filament background active (`frontend/tests/accessibility/filament.a11y.spec.tsx`).
- [ ] T021 [P] Write failing unit tests for ship multi-pane viewer state (3D asset loading, tab navigation) using mocked JSON contract (`frontend/tests/components/ShipViewer.spec.tsx`).
- [ ] T022 [P] Write failing unit tests for blueprint market chart hover highlighting and dummy/live data wiring (`frontend/tests/components/BlueprintMarketChart.spec.tsx`).

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T023 Implement ingestion downloader with httpx + tenacity, including resume support, logging, and mirror fallback (`ingestion/src/fetch_and_load.py`).
- [ ] T024 Implement decompressor + manifest writer ensuring types → blueprints order, SHA-256 manifest, JSON derivatives, and preset derivation persisted (`ingestion/src/pipeline.py`).
- [ ] T025 Implement dogma attribute join + normalization producing aggregated ship stats (`ingestion/src/dogma.py`).
- [ ] T026 Implement blueprint ingestion covering activities, skills, products, invention probabilities, and presets (`ingestion/src/blueprints.py`).
- [ ] T027 Implement Adam4EVE market adapter with rate limiter, incremental windowing, and snapshot persistence (`ingestion/src/market_adapter.py`).
- [ ] T028 Author Alembic migration creating `sde_versions`, `invCategories`, `invGroups`, `invTypes` (ships only), `type_attributes`, `ship_presets`, `blueprints`, `blueprint_presets`, `industry_activity`, `industry_activity_materials`, `industry_activity_products`, `blueprint_skills`, `blueprint_invention`, and `market_snapshots` with indexes aligned to data model (`backend/src/db/migrations/V001__sde_tables.py`).
- [ ] T029 Build repository layer for manifest lookups, ship/blueprint queries, market snapshots (async SQLAlchemy) (`backend/src/db/repository.py`).
- [ ] T030 Implement Pydantic schemas + response models for manifest, ship, blueprint, and market payloads (`backend/src/schemas/*.py`).
- [ ] T031 [P] Implement `/health` FastAPI route returning manifest freshness + ingestion status (`backend/src/api/health.py`).
- [ ] T032 [P] Implement `/ships/{type_id}` FastAPI route with TanStack-friendly pagination/filter helpers and manifest headers (`backend/src/api/ships.py`).
- [ ] T033 [P] Implement `/blueprints/{blueprint_type_id}` FastAPI route surfacing activities, skills, invention metadata, and preset theming (`backend/src/api/blueprints.py`).
- [ ] T034 [P] Implement `/market/{type_id}` FastAPI route returning 7/30-day windows with provider filtering (`backend/src/api/market.py`).
- [ ] T035 Implement TanStack Query hook exposing items + manifest metadata + rate limit notices (`frontend/src/hooks/useItems.ts`).
- [ ] T036 Render filament grid header with manifest badge + reduced-motion toggle controlling Background Web component (`frontend/src/components/FilamentGrid.tsx`).
- [ ] T037 Integrate Background Web canvas component behind main layout with performance guardrails (`frontend/src/components/BackgroundWeb.tsx`).
- [ ] T038 Implement Three.js-based ship viewer with faction lighting presets and glTF asset loader (`frontend/src/components/cards/ShipViewer.tsx`).
- [ ] T039 Build ship multi-pane layout (characteristics, bonuses, slots, lore) wired to viewer state (`frontend/src/components/cards/ShipDetails.tsx`).
- [ ] T040 Implement blueprint industry layout: BOM grid, process visualization, outcome panel (`frontend/src/components/cards/BlueprintIndustry.tsx`).
- [ ] T041 Implement blueprint market chart with dummy fallback + live data toggle (`frontend/src/components/cards/BlueprintMarketChart.tsx`).
- [ ] T042 Create dummy data generator and live adapter bridge for blueprint charts, documenting provider endpoints/limits (`frontend/src/lib/marketDataSource.ts`, `docs/data/market.md`).
- [ ] T043 Stage faction lighting configuration + asset manifest for ships (`frontend/src/assets/ships/manifest.json`, `frontend/src/lib/factionLighting.ts`).

## Phase 3.4: Integration
- [ ] T044 Instrument structured logging + metrics for ingestion worker and FastAPI backend (including market adapter counters) (`ingestion/src/logging.py`, `backend/src/observability/logger.py`).
- [ ] T045 Configure health/readiness endpoints and Docker compose healthchecks for all services (`backend/src/api/health.py`, `docker/compose.yml`).
- [ ] T046 [P] Add scheduler/entrypoint scripts to trigger nightly SDE ingest + market snapshot refresh respecting rate limits (`docker/entrypoints/`).
- [ ] T047 [P] Seed quickstart documentation describing docker compose workflow, manual ingestion trigger, market adapter configuration, and manifest rotation checks (`docs/quickstart.md`).
- [ ] T048 [P] Create monitoring dashboard stub (metrics list + manual snapshots) focusing on ingestion latency, manifest freshness, and provider rate usage (`docs/observability.md`).

## Phase 3.5: Polish
- [ ] T049 [P] Add unit tests for repository query builders and manifest caching invalidation (`backend/tests/test_repository.py`).
- [ ] T050 Capture performance baseline via large dataset render script and log results (`docs/performance.md`).
- [ ] T051 [P] Update changelog entries summarizing Docker, ingestion, and market bootstrap release (`docs/CHANGELOG.md`).
- [ ] T052 Execute manual quickstart walkthrough, capture screenshots of manifest badge + Background Web + new viewers, and attach to review notes (`docs/review-notes.md`).

## Dependencies
- T009–T022 must be complete (and failing) before implementing T023–T043.
- T023 feeds T024–T027; ingestion pipeline + market adapter must complete before migrations (T028) run against data.
- T028 precedes backend repository + API tasks (T029–T034).
- Frontend tasks (T035–T043) depend on backend endpoints and manifest metadata.
- Integration tasks (T044–T048) require successful core implementation.
- Polish tasks (T049–T052) follow integration.

## Parallel Example
```
# Parallelize independent FastAPI endpoint tests after ingestion fixtures exist:
Task: "Write failing FastAPI test for `/ships/{type_id}` returning manifest headers and dogma-derived stats"
Task: "Write failing FastAPI test for `/blueprints/{blueprint_type_id}` returning activities, skill requirements, invention metadata"
Task: "Write failing FastAPI test for `/market/{type_id}` returning 7/30-day series"
```

## Notes
- [P] tasks indicate separate files/services; ensure no shared state collisions.
- Maintain TDD: ensure each test fails before implementing corresponding functionality.
- Validate Docker compose stack after each major milestone to protect shared volume behaviour.
- Persist ingestion fixtures outside repo-sensitive data by leveraging `data/sde/_downloads/` volume.
- Respect provider limits defined in research (e.g., Adam4EVE 30 requests/minute, jittered retry) when implementing market adapters and schedulers.

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each API contract file → contract test + implementation task (manifest-aware).
   - Each ingestion contract → downloader, decompressor, dogma join, blueprint ingestion, market adapter tasks.
2. **From Data Model**:
   - Each entity → migration/model task (ship presets, dogma attribute definitions/values, blueprint skills, market snapshots).
   - Manifest schema → storage + validation tasks.
3. **From User Stories**:
   - Ingestion trigger + status scenarios → logging + UI badge tasks.
   - Accessibility/reduced-motion → UI + testing tasks.
   - Manifest visibility + market charts → docs + endpoint tasks.
4. **Ordering**:
   - Setup → Tests → Ingestion → Manifest → API → UI → Observability → Polish.
   - Respect dependencies when marking [P].

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All contracts have corresponding tests
- [ ] All entities (including dogma + blueprint + market tables) have migration/model tasks
- [ ] All tests precede implementation
- [ ] UI tasks include accessibility & reduced-motion coverage
- [ ] Manifest metadata and market snapshots exposed through API/UI tasks
- [ ] Parallel tasks truly independent
- [ ] Each task specifies exact file path
- [ ] Docker/observability steps captured
