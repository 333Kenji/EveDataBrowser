# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: ingestion scope, API surface, UI requirements, observability notes
2. Load optional design documents:
   → data-model.md: Extract entities, ingestion run states → model tasks
   → contracts/: Each file → contract test + implementation task
   → research.md & quickstart.md: Extract decisions → setup, accessibility, and Docker tasks
3. Generate tasks by category:
   → Setup: Docker compose, Postgres migrations, dependency installs
   → Tests: ingestion parser fixtures, API contract tests, UI accessibility tests
   → Core: ingestion pipelines, DB migrations, API handlers, React views
   → Integration: seeds, metrics, health checks, container wiring
   → Polish: docs, manual validation, rollout notes
4. Apply task rules:
   → Different files/services = mark [P] for parallel
   → Same file/service = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph covering ingestion → API → UI flow
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have migrations/models?
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
- **Docker & ops**: `docker/`, `.env.example`, `docs/`
- Adjust names if the plan defines an alternate structure (document the change)

## Phase 3.1: Setup
- [ ] T001 Provision `docker/compose.yml` service entries for ingestion, backend, frontend, and Postgres
- [ ] T002 Define base Dockerfiles (`docker/Dockerfile.ingestion`, `docker/Dockerfile.backend`, `docker/Dockerfile.frontend`)
- [ ] T003 [P] Initialize project dependencies (pnpm workspaces or equivalent) and configure shared linting/formatting

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 Author ingestion parser regression test using latest Eve SDE fixture in `ingestion/tests/parser.test.ts`
- [ ] T005 Create migration + seed verification test in `backend/tests/db/migrations.spec.ts`
- [ ] T006 [P] Write API contract test for `GET /api/items` in `backend/tests/contract/items.get.spec.ts`
- [ ] T007 [P] Add React accessibility test for filament grid filtering in `frontend/tests/components/FilamentGrid.spec.tsx`

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T008 Implement YAML ingestion pipeline with checksum logging in `ingestion/src/pipeline.ts`
- [ ] T009 Apply Postgres migration and seed scripts in `backend/src/db/migrations/`
- [ ] T010 [P] Expose `GET /api/items` Express handler with filter + pagination in `backend/src/api/items.ts`
- [ ] T011 [P] Build TanStack Query hook and data helpers in `frontend/src/hooks/useItems.ts`
- [ ] T012 Render filament grid + detail pane in `frontend/src/components/FilamentGrid.tsx`
- [ ] T013 Wire ingestion job trigger (CLI or worker) documenting run metadata in `ingestion/src/runner.ts`

## Phase 3.4: Integration
- [ ] T014 Configure structured logging + metrics exporters across ingestion/backend in `ingestion/src/logger.ts` and `backend/src/observability/`
- [ ] T015 Ensure Docker compose health checks and readiness probes are defined in `docker/compose.yml`
- [ ] T016 [P] Seed accessibility snapshots and keyboard navigation scripts in `frontend/tests/accessibility/`
- [ ] T017 [P] Document operational quickstart in `docs/quickstart.md` aligning with constitution workflows

## Phase 3.5: Polish
- [ ] T018 [P] Add unit tests for query builders in `backend/tests/unit/queryBuilder.spec.ts`
- [ ] T019 Validate large dataset performance locally and record findings in `docs/performance.md`
- [ ] T020 [P] Update changelog / release notes capturing Docker images and migration IDs
- [ ] T021 Run manual browsing script from `quickstart.md` and capture screenshots for reviewers

## Dependencies
- Tests (T004-T007) before corresponding implementation (T008-T013)
- T008 feeds T009 and T013
- T010 depends on migrations (T009) and ingestion data (T008)
- T012 depends on hooks (T011) and API readiness (T010)
- Integration tasks (T014-T017) require core implementation complete
- Polish (T018-T021) follows integration pass

## Parallel Example
```
# Launch T006-T007 together while ingestion tests run:
Task: "API contract test for GET /api/items in backend/tests/contract/items.get.spec.ts"
Task: "React accessibility test for filament grid filtering in frontend/tests/components/FilamentGrid.spec.tsx"
```

## Notes
- [P] tasks = different files/services, no shared state
- Verify tests fail before implementing
- Commit after each task group (tests → implementation → polish)
- Ensure Docker compose stays functional after each major task

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each API contract file → contract test + handler task
   - Each ingestion contract → parser verification task

2. **From Data Model**:
   - Each entity → migration/model task
   - Relationships → query/service tasks

3. **From User Stories**:
   - Each browsing scenario → UI integration test task
   - Accessibility requirements → a11y validation task

4. **Ordering**:
   - Setup → Tests → Ingestion → API → UI → Observability/Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All contracts have corresponding tests
- [ ] All entities have migration/model tasks
- [ ] All tests precede implementation
- [ ] UI tasks include accessibility coverage
- [ ] Parallel tasks truly independent
- [ ] Each task specifies exact file path
- [ ] Docker/observability steps captured
