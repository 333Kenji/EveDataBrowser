# Tasks: CCP SDE ingestion bootstrap

**Input**: Design documents from `/specs/001-bootstrap-ingestion/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: ingestion scope, manifest expectations, API surface, UI requirements, observability notes
2. Load optional design documents:
   → data-model.md: Extract entities, ingestion run states, manifest schema → model tasks
   → contracts/: Each file → contract test + implementation task
   → research.md & quickstart.md: Extract decisions → setup, accessibility, Background Web, and Docker tasks
3. Generate tasks by category:
   → Setup: Docker compose, Postgres migrations, shared `data/sde/` volume, dependency installs
   → Tests: ingestion downloader/decompressor fixtures, manifest verification, API contract tests, UI accessibility & reduced-motion tests
   → Core: ingestion pipelines, manifest writer, DB migrations, API handlers, React views (filament cards, Background Web controls)
   → Integration: seeds, metrics, health checks, container wiring, manifest exposure in responses
   → Polish: docs, manual validation, rollout notes
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
   → UI flows have accessibility coverage?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files/services, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Ingestion worker**: `ingestion/src/`, `ingestion/tests/`
- **API**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/tests/`
- **Docker & ops**: `docker/`, `.env.example`, `docs/`, `data/sde/`
- Adjust names if the plan defines an alternate structure (document the change)

## Phase 3.1: Setup
- [ ] T001 Create `docker/compose.yml` skeleton with services for Postgres, ingestion worker, backend API, frontend, and shared `data-sde` volume (`docker/compose.yml`).
- [ ] T002 Draft multi-stage Dockerfile for ingestion worker with Python runtime and build cache layers (`docker/Dockerfile.ingestion`).
- [ ] T003 Draft multi-stage Dockerfile for backend API with Node.js runtime and health probe defaults (`docker/Dockerfile.backend`).
- [ ] T004 Draft multi-stage Dockerfile for frontend build + dev server (`docker/Dockerfile.frontend`).
- [ ] T005 Scaffold `.env.example` with required variables (DATABASE_URL, REDIS_URL placeholder, SDE_BASE_URL, SDE_MANIFEST_PATH) (`.env.example`).
- [ ] T006 [P] Initialize pnpm workspace + package manifests for backend/frontend and align shared linting/formatting configs (`package.json`, `pnpm-workspace.yaml`).
- [ ] T007 [P] Add pre-commit tooling (ruff, eslint, prettier) configs aligned with Docker images (`pyproject.toml`, `.eslintrc.cjs`, `.prettierrc`).
- [ ] T008 Seed `data/sde/` directory structure with `_downloads/.gitkeep`, placeholder manifest/type/blueprint JSON files, and README describing usage (`data/sde/`).

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
- [ ] T009 Define pytest fixture for CCP static data HTML snapshot + zipped YAML to drive downloader tests (`ingestion/tests/conftest.py`).
- [ ] T010 Write failing tests for downloader discovery, retry/backoff, and missing-asset failure handling using httpx mocking (`ingestion/tests/test_fetch_and_load.py`).
- [ ] T011 Write failing tests ensuring `.bz2` decompression → manifest SHA-256 recording → JSON derivative generation and checksum-mismatch aborts (`ingestion/tests/test_manifest_pipeline.py`).
- [ ] T012 [P] Write failing contract test for ingestion status endpoint exposing manifest metadata (`backend/tests/contract/manifest.get.spec.ts`).
- [ ] T013 [P] Write failing contract test for `GET /api/items` returning manifest headers and filtered type data (`backend/tests/contract/items.get.spec.ts`).
- [ ] T014 [P] Write failing Vitest suite for Background Web reduced-motion toggle + manifest display badge in grid header (`frontend/tests/components/FilamentGrid.spec.tsx`).
- [ ] T015 [P] Write accessibility snapshot test verifying keyboard navigation and focus states with filament background active (`frontend/tests/accessibility/filament.a11y.spec.tsx`).

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T016 Implement ingestion downloader with httpx + tenacity, including resume support and timeout strategy (`ingestion/src/fetch_and_load.py`).
- [ ] T017 Implement decompressor + manifest writer ensuring types → blueprints order, SHA-256 manifest, checksum validation, and JSON derivatives persisted (`ingestion/src/pipeline.py`).
- [ ] T018 Implement ingestion run metadata logging, failure abort logic (missing assets / checksum mismatch), and idempotency check (`ingestion/src/runner.py`).
- [ ] T019 Author Alembic migration creating `sde_versions`, `invCategories`, `invGroups`, `invTypes` (ships only), `invBlueprintTypes`, `industryActivity`, `industryActivityMaterials`, `industryActivityProducts`, and attribute views with indexes aligned to data model (`backend/src/db/migrations/V001__sde_tables.py`).
- [ ] T020 Build typed data access layer for ship/blueprint tables with pagination/filter helpers (`backend/src/db/sde_repository.ts`).
- [ ] T021 [P] Implement manifest health endpoint returning latest manifest + ingestion status (`backend/src/api/manifest.ts`).
- [ ] T022 [P] Implement `GET /api/items` endpoint with manifest headers, filter/pagination, and Postgres-backed queries (`backend/src/api/items.ts`).
- [ ] T023 [P] Implement ingestion status broadcaster (e.g., message bus/log integration) so UI can display current state (`backend/src/services/ingestionStatus.ts`).
- [ ] T024 Implement TanStack Query hook exposing items + manifest metadata (`frontend/src/hooks/useItems.ts`).
- [ ] T025 Render filament grid header with manifest badge + reduced-motion toggle controlling Background Web component (`frontend/src/components/FilamentGrid.tsx`).
- [ ] T026 Integrate Background Web canvas component behind main layout with performance guardrails (`frontend/src/components/BackgroundWeb.tsx`).

## Phase 3.4: Integration
- [ ] T027 Instrument structured logging + metrics for ingestion worker and backend API (`ingestion/src/logging.py`, `backend/src/observability/logger.ts`).
- [ ] T028 Configure health/readiness endpoints and Docker compose healthchecks for all services (`backend/src/api/health.ts`, `docker/compose.yml`).
- [ ] T029 [P] Add Docker entrypoints + wait-for scripts ensuring Postgres ready before migrations/ingestion start (`docker/entrypoints/`).
- [ ] T030 [P] Seed quickstart documentation describing docker compose workflow, manual ingestion trigger, and manifest rotation checks (`docs/quickstart.md`).
- [ ] T031 [P] Create monitoring dashboard stub (metrics list + manual snapshots) in `docs/observability.md` focusing on ingestion latency and manifest freshness.

## Phase 3.5: Polish
- [ ] T032 [P] Add unit tests for repository query builders and manifest caching invalidation (`backend/tests/unit/sde_repository.spec.ts`).
- [ ] T033 Capture performance baseline via large dataset render script and log results (`docs/performance.md`).
- [ ] T034 [P] Update changelog entries summarizing Docker & ingestion bootstrap release (`docs/CHANGELOG.md`).
- [ ] T035 Execute manual quickstart walkthrough, capture screenshots of manifest badge + Background Web, and attach to review notes (`docs/review-notes.md`).

## Dependencies
- T009–T015 must be complete (and failing) before implementing T016–T026.
- T016 feeds T017 and T018; ingestion pipeline must complete before migrations (T019) run against real data.
- T019 precedes backend API tasks (T020–T023).
- Frontend tasks (T024–T026) depend on backend endpoints and manifest metadata.
- Integration tasks (T027–T031) require successful core implementation.
- Polish tasks (T032–T035) follow integration.

## Parallel Example
```
# Parallelize independent contract and UI tests after fixtures exist:
Task: "Write failing contract test for ingestion status endpoint exposing manifest metadata"
Task: "Write failing Vitest suite for Background Web reduced-motion toggle + manifest display badge"
Task: "Write failing contract test for GET /api/items returning manifest headers" (runs in parallel once Postgres fixtures defined)
```

## Notes
- [P] tasks indicate separate files/services; ensure no shared state collisions.
- Maintain TDD: ensure each test fails before implementing corresponding functionality.
- Validate Docker compose stack after each major milestone to protect shared volume behaviour.
- Persist ingestion fixtures outside repo-sensitive data by leveraging `data/sde/_downloads/` volume.

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each API contract file → contract test + implementation task (manifest-aware).
   - Each ingestion contract → downloader, decompressor, manifest validation tasks.
2. **From Data Model**:
   - Each entity → migration/model task.
   - Manifest schema → storage + validation tasks.
3. **From User Stories**:
   - Ingestion trigger + status scenarios → logging + UI badge tasks.
   - Accessibility/reduced-motion → UI + testing tasks.
   - Manifest visibility → docs + endpoint tasks.
4. **Ordering**:
   - Setup → Tests → Ingestion → Manifest → API → UI → Observability → Polish.
   - Respect dependencies when marking [P].

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All contracts have corresponding tests
- [ ] All entities and manifest fields have migration/model tasks
- [ ] All tests precede implementation
- [ ] UI tasks include accessibility & reduced-motion coverage
- [ ] Manifest metadata exposed through API/UI tasks
- [ ] Parallel tasks truly independent
- [ ] Each task specifies exact file path
- [ ] Docker/observability steps captured
