# Implementation Plan: CCP SDE ingestion bootstrap

**Branch**: `[001-bootstrap-ingestion]` | **Date**: 2025-09-23 | **Spec**: [/specs/001-bootstrap-ingestion/spec.md](spec.md)
**Input**: Feature specification from `/specs/001-bootstrap-ingestion/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Eve Data Browser scope: ingestion (CCP SDE), API, frontend
   → Capture SDE manifest/checksum obligations, Postgres implications, frontend reuse surfaces (Background Web, filament cards)
3. Populate the Constitution Check section using Eve Data Browser constitution v1.1.0
   → Map each principle to measurable gating questions
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking with mitigation
   → If no justification possible: ERROR "Realign with constitution before proceeding"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → Resolve unknowns about SDE discovery/downloading, manifest schema, dataset cadence, Postgres migrations, UI access patterns, animation performance
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `.specify/scripts/bash/update-agent-context.sh codex`)
   → Ensure contracts cover ingestion jobs (download → decompress → manifest), API read endpoints, and UI interactions (filter + filament canvas) required to browse data
7. Re-evaluate Constitution Check section
   → If new violations: Refine design, return to Phase 1 deliverables
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → Highlight Docker touchpoints, manifest persistence, observability hooks, and testing strategy for ingestion/API/UI
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Bootstrap the Eve Data Browser ingest-and-browse workflow by establishing the shared Docker compose stack, implementing the authoritative SDE ingestion run (download → decompress → manifest → Postgres), wiring the Postgres schema, and delivering a React filament UI that surfaces manifest-aware dataset browsing.

## Technical Context
**Language/Version**: Python 3.12 for ingestion worker and FastAPI backend; Node.js 20 / TypeScript 5 for frontend; React 18  
**Primary Dependencies**: httpx, tenacity, FastAPI 0.111, Pydantic, SQLAlchemy + Alembic migrations, Postgres 15 client libs, Vite 5, React 18, TanStack Query 5  
**Storage**: PostgreSQL 15 (managed via versioned migrations)  
**Testing**: pytest, Vitest, Jest + Supertest  
**Target Platform**: Dockerized multi-service stack (ingestion worker, backend API, frontend SPA, Postgres)  
**Project Type**: web (frontend + backend + ingestion worker)  
**Performance Goals**: Complete full SDE ingestion < 10 minutes; render primary dataset grid < 500 ms for cached datasets  
**Constraints**: API remains read-only; frontend maintains WCAG AA + reduced-motion fallback; animations capped to 60fps without blocking UI  
**Scale/Scope**: Full CCP SDE snapshot (~GB scale) refreshed on CCP releases; concurrency up to 20 simultaneous viewers  
**Ingestion Cadence**: Nightly scheduled check with manual override for emergency updates  
**Observability**: Structured JSON logs, ingestion + API health probes, Prometheus-friendly metrics  
**Frontend Palette & Motifs**: Reuse EVEIndy Background Web canvas, filament cards, gradient palette (base #0a0b10, accents #22d3ee/#8b5cf6/#22c55e)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Data Fidelity First**: Ingestion plan mirrors `fetch_and_load_sde` flow with retry/backoff, `.bz2` handling, manifest SHA-256, enforce types → blueprints order.
- [x] **Postgres As Source Of Truth**: Plan covers migrations, seeds, typed helpers, and manifest-linked tables with no shadow stores.
- [x] **Responsive Filament UI**: Plan acknowledges Background Web integration, gradient motif, accessibility, and virtualization requirements.
- [x] **Spec Kit Operational Discipline**: Plan references required Spec Kit artifacts, research deliverables, and review gates.
- [x] **Observable & Containerized Delivery**: Plan establishes Docker compose stack, shared `data/sde/` volume, logging/metrics, and health checks.

## Project Structure

### Documentation (this feature)
```
specs/001-bootstrap-ingestion/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
ingestion/
├── src/
├── pipelines/
└── tests/

backend/
├── src/
│   ├── api/
│   ├── services/
│   └── db/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── hooks/
└── tests/

data/
└── sde/
    ├── _downloads/
    ├── manifest.json
    ├── type_ids.json
    ├── blueprints.json
    └── attributes.json

docker/
├── Dockerfile.*
└── compose.yml
```

**Structure Decision**: Default to the above stack. Document any deviation if the feature slices experimentation (e.g., ingestion-only spike).

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context**:
   - Confirm authoritative CCP static data endpoints, mirror options, and versioning cadence.
   - Determine required subset of SDE YAML (`types.yaml`, `typeDogma.yaml`, `dogmaAttributes.yaml`, `typeMaterials.yaml`, `blueprints.yaml`, `marketGroups.yaml`, `categories.yaml`, `groups.yaml`) and projected storage footprint after JSON conversion while documenting megafiles intentionally deferred (e.g., `mapMoons.yaml`).
   - Validate checksum algorithm expectations and manifest schema used in prior EVEIndy project.
   - Assess Docker volume strategies for persisting `data/sde/` across services and environments.
   - Identify accessibility requirements for Background Web animations (reduced-motion toggles, performance budgets).

2. **Generate and dispatch research tasks**:
```
For each unknown in Technical Context:
  Task: "Research {unknown} for Eve Data Browser bootstrap"
For each technology choice:
  Task: "Summarize best practices for {tech} in Eve Data Browser context"
For ingestion cadence/manifest:
  Task: "Confirm CCP SDE versioning + checksum references"
```

3. **Consolidate findings** in `research.md` using format:
   - Decision
   - Rationale
   - Alternatives considered

**Output**: `research.md` capturing vetted endpoints, manifest schema, Docker volume approach, accessibility considerations.

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Model data & ingestion artifacts** in `data-model.md`:
   - SDE manifest entity (version, checksum, status, source URL, timestamps).
   - Ship and blueprint models with provenance fields, presets (faction/race/group/category), Postgres indexing guidance, retention expectations, plus presentation metadata (3D asset descriptors, dummy chart data sources).
   - Attribute join surfaces: map `typeDogma.yaml` → `dogmaAttributes.yaml` with units/highIsGood metadata for ship stats surfaced in UI.
   - Blueprint activity tables covering manufacturing + invention (materials, skills, probability, time) aligned with `blueprints.yaml` schema.
   - Ingestion run state machine (queued → running → succeeded/failed) with failure metadata.

2. **Generate API & UI contracts** for browsing features:
   - Read-only endpoints supplying filtered type/blueprint data with manifest metadata headers/payload fields.
   - Health/manifest endpoint exposing current version, timestamps, and last successful ingestion status.
   - React view definitions covering filament grid layout, search/filter controls, manifest badge placement, reduced-motion toggles, 3D viewer requirements, and blueprint market chart behaviour (including dummy data schema).
   - FastAPI contract definitions for `/ships/{type_id}`, `/blueprints/{blueprint_type_id}`, `/market/{type_id}`, `/health`, ensuring response payloads expose manifest metadata + localized labels.
   - Market data contracts: `/market/{type_id}` time series schema, Forge-only region scope, provider/window parameters, and snapshot persistence expectations.

3. **Generate contract tests** from contracts:
   - Failing tests for ingestion pipeline contract (download, decompress, manifest generation) with fixture responses.
   - Failing tests for API endpoints verifying manifest version exposure, pagination, and filtering semantics.

4. **Extract test scenarios** from user stories:
   - Manual ingestion trigger success/failure flows.
   - Re-ingestion idempotency (same checksum, no data churn).
   - Failure path when assets are missing or checksum validation fails, confirming run abort behaviour and operator feedback.
   - Frontend dataset view confirming manifest metadata surfaces (timestamp, version), 3D viewer loads, blueprint chart interactions respond to hover, and market API mock/live pathways behave as expected (Forge region).
   - Reduced-motion toggle disabling Background Web animation.

5. **Update agent context** via `.specify/scripts/bash/update-agent-context.sh codex` with new dependency commitments (httpx, tenacity, FastAPI, SQLAlchemy + Alembic, TanStack Query).

**Output**: `data-model.md`, `contracts/` contents, failing tests, `quickstart.md`, updated agent context.

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md`.
- Derive ingestion downloader/decompressor/manifest tasks from contracts + data model.
   - Create backend tasks for manifest-aware FastAPI endpoints, `market/{type_id}` handler, and Postgres migrations (including dogma attribute + blueprint activity tables).
- Create frontend tasks for filament grid bootstrapping and manifest display.
- Include Docker + observability tasks to wire shared `data/sde/` volume and health checks.

**Ordering Strategy**:
- Setup Docker + Postgres + shared volume → Tests (ingestion, manifest, API, UI accessibility) → Implement ingestion pipeline → Apply migrations → Implement API endpoints → Wire frontend → Observability + docs.
- Mark [P] only when files/services are independent (e.g., parallel frontend and API tests after ingestion fixtures ready).

**Estimated Output**: 28–32 tasks covering ingestion foundation, Docker compose + volume wiring, manifest exposure, and UI surfacing.

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan.

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command output).

**Phase 4**: Implementation (execute tasks sequentially, honoring TDD and constitution gates).

**Phase 5**: Validation (run automated tests, execute quickstart, confirm observability dashboards and manifest rotation).

## Change Management
- Any revision to this feature plan or its paired `spec.md` REQUIRES updating `specs/001-bootstrap-ingestion/tasks.md` before implementation.
- Re-run the `/tasks` workflow (or manually append tasks) so new scope is represented by actionable work.
- Reviewers must verify that changes in this directory remain in sync with the top-level `plan.md`, `specify.md`, and root `tasks.md`, blocking merges when coverage gaps persist.

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning approach defined (/plan command)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v1.2.0 - See `/memory/constitution.md`*
