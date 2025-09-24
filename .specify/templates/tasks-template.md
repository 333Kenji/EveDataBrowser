# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
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
- [ ] T001 Provision `docker/compose.yml` service entries for ingestion, backend, frontend, and Postgres; mount `data/sde/` volume
- [ ] T002 Define base Dockerfiles (`docker/Dockerfile.ingestion`, `docker/Dockerfile.backend`, `docker/Dockerfile.frontend`) with multi-stage builds and shared node/python cache layers
- [ ] T003 [P] Initialize project dependencies (pnpm workspaces or equivalent) and configure shared linting/formatting + commit hooks
- [ ] T004 Scaffold `data/sde/_downloads/.gitkeep` and manifest placeholders to ensure volume parity across environments

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T005 Author ingestion downloader test covering CCP static data discovery + retry in `ingestion/tests/fetch_and_load.spec.ts`
- [ ] T006 Create decompression + manifest checksum test in `ingestion/tests/manifest.spec.ts`
- [ ] T007 [P] Write API contract test for `GET /api/items` returning manifest metadata in `backend/tests/contract/items.get.spec.ts`
- [ ] T008 [P] Add React accessibility & reduced-motion test for filament grid and Background Web toggle in `frontend/tests/components/FilamentGrid.spec.tsx`

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T009 Implement SDE downloader with httpx + tenacity and resume support in `ingestion/src/fetchAndLoad.ts`
- [ ] T010 Build decompressor + manifest writer (types → blueprints) persisting to `data/sde/` in `ingestion/src/pipeline.ts`
- [ ] T011 Apply Postgres migration and seed scripts for `type_ids`, `blueprints`, `industry_materials`, `structures`, `rigs` in `backend/src/db/migrations/`
- [ ] T012 [P] Expose `GET /api/items` Express handler with filters, pagination, and manifest headers in `backend/src/api/items.ts`
- [ ] T013 [P] Build TanStack Query hook and data helpers (manifest-aware caching) in `frontend/src/hooks/useItems.ts`
- [ ] T014 Render filament grid + detail pane with Background Web canvas integration in `frontend/src/components/FilamentGrid.tsx`
- [ ] T015 Wire ingestion job trigger (CLI or worker) documenting run metadata + manifest diffs in `ingestion/src/runner.ts`

## Phase 3.4: Integration
- [ ] T016 Configure structured logging + metrics exporters across ingestion/backend in `ingestion/src/logger.ts` and `backend/src/observability/`
- [ ] T017 Ensure Docker compose health checks, readiness probes, and manifest volume permissions are defined in `docker/compose.yml`
- [ ] T018 [P] Seed accessibility snapshots, keyboard navigation scripts, and reduced-motion fallbacks in `frontend/tests/accessibility/`
- [ ] T019 [P] Document operational quickstart (manifest refresh + UI expectations) in `docs/quickstart.md` aligning with constitution workflows

## Phase 3.5: Polish
- [ ] T020 [P] Add unit tests for manifest parsing + query builders in `backend/tests/unit/queryBuilder.spec.ts`
- [ ] T021 Validate large dataset performance (virtualized grid, Background Web FPS) and record findings in `docs/performance.md`
- [ ] T022 [P] Update changelog / release notes capturing Docker images, manifest version, and migration IDs
- [ ] T023 Run manual browsing script from `quickstart.md` and capture screenshots for reviewers

## Dependencies
- Tests (T005-T008) before corresponding implementation (T009-T015)
- T009 feeds T010 and T015
- T011 must precede T012
- T013 requires API readiness (T012) and manifest context (T010)
- T014 depends on T013 and designs from spec
- Integration tasks (T016-T019) require core implementation complete
- Polish (T020-T023) follows integration pass

## Parallel Example
```
# Launch T007-T008 together while ingestion tests run:
Task: "API contract test for GET /api/items in backend/tests/contract/items.get.spec.ts"
Task: "React accessibility & reduced-motion test for filament grid in frontend/tests/components/FilamentGrid.spec.tsx"
```

## Notes
- [P] tasks = different files/services, no shared state
- Verify tests fail before implementing
- Commit after each task group (tests → implementation → polish)
- Ensure Docker compose + manifest storage stay functional after each major task

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each API contract file → contract test + handler task (include manifest metadata)
   - Each ingestion contract → downloader/decompressor/manifest verification tasks

2. **From Data Model**:
   - Each entity → migration/model task
   - Manifest schema → storage + validation tasks
   - Relationships → query/service tasks

3. **From User Stories**:
   - Each browsing scenario → UI integration test task
   - Accessibility & reduced-motion requirements → a11y validation task
   - Manifest visibility requirements → UI + docs tasks

4. **Ordering**:
   - Setup → Tests → Ingestion → Manifest → API → UI → Observability/Polish
   - Dependencies block parallel execution

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
