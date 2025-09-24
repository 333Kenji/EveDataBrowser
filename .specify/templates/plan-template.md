# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

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
[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context
**Language/Version**: [e.g., Node.js 20, Python 3.12 for ingestion, React 18 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., Vite, Express, TanStack Query, httpx, tenacity or NEEDS CLARIFICATION]  
**Storage**: PostgreSQL (version?) or NEEDS CLARIFICATION  
**Testing**: [e.g., Vitest, Jest, pytest, Supertest or NEEDS CLARIFICATION]  
**Target Platform**: Dockerized web stack (frontend, API, ingestion) or NEEDS CLARIFICATION  
**Project Type**: web (frontend + backend + ingestion worker)  
**Performance Goals**: [e.g., dataset render <500ms, ingestion per archive <5 min or NEEDS CLARIFICATION]  
**Constraints**: [e.g., read-only API, WCAG AA, animation FPS budget, memory ceilings or NEEDS CLARIFICATION]  
**Scale/Scope**: [e.g., full SDE snapshot, concurrent viewers, ingestion frequency or NEEDS CLARIFICATION]  
**Ingestion Cadence**: [e.g., nightly, on-demand or NEEDS CLARIFICATION]  
**Observability**: [logging/metrics expectations or NEEDS CLARIFICATION]  
**Frontend Palette & Motifs**: [confirm reuse of Background Web, gradients, card layouts or NEEDS CLARIFICATION]

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] **Data Fidelity First**: Ingestion plan mirrors `fetch_and_load_sde` (discover, download with retry, decompress `.bz2`, manifest SHA-256, enforce types → blueprints order).
- [ ] **Postgres As Source Of Truth**: Plan documents migrations, seeds, typed data helpers, and manifest-aware tables without shadow stores.
- [ ] **Responsive Filament UI**: UI scope covers Background Web canvas, filament card styling, accessibility, and performance guardrails.
- [ ] **Spec Kit Operational Discipline**: Plan references required Spec Kit artifacts, testing cadence, and reviewer gates.
- [ ] **Observable & Containerized Delivery**: Docker story, structured logging, health endpoints, metrics, and shared `data/sde/` volume are accounted for.

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
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
    └── structures.json

docker/
├── Dockerfile.*
└── compose.yml
```

**Structure Decision**: Default to the above stack unless Technical Context indicates a scoped subset (e.g., UI-only spike). Document deviations.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research ingestion/API/UI specifics
   - For each dependency → capture version support inside Docker and Background Web performance constraints
   - For schema questions → document required SDE references, manifest format, checksum expectations

2. **Generate and dispatch research tasks**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for Eve Data Browser {feature}"
   For each technology choice:
     Task: "Summarize best practices for {tech} in Eve Data Browser context"
   For ingestion cadence/manifest:
     Task: "Confirm CCP SDE versioning + checksum references"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved and constitution gates satisfied

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Model data & ingestion artifacts** in `data-model.md`:
   - Entities, fields, relationships, provenance metadata, manifest structure
   - Ingestion run states and error handling, including checksum failures

2. **Generate API contracts** for browsing features:
   - For each user filter/search → endpoint + response schema (include manifest version + updated_at fields)
   - Capture pagination, sorting, and Postgres-backed queries

3. **Generate contract tests** from contracts:
   - One test file per endpoint or ingestion pipeline contract (manifest aware)
   - Tests must fail (no implementation yet) and assert Postgres fixtures

4. **Extract test scenarios** from user stories:
   - Browser interactions, accessibility checks, animation toggles, ingestion updates
   - Quickstart test = end-to-end data visibility scenario referencing manifest version

5. **Update agent context**:
   - Run `.specify/scripts/bash/update-agent-context.sh codex`
   - Add new technologies or decisions since last update (httpx, tenacity, Background Web specifics)
   - Keep under 150 lines for token efficiency

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Ingestion pipelines → downloader + decompressor + manifest writer tasks [P]
- API endpoints → contract tests then Express handlers with manifest metadata [P]
- UI flows → component tests then implementation tasks (Background Web, filament cards, virtualized grids)

**Ordering Strategy**:
- Setup Docker + Postgres + shared `data/sde/` volume → Tests → Ingestion → API → UI → Observability
- Mark [P] for independent files/services only

**Estimated Output**: 30±5 numbered, ordered tasks in tasks.md covering ingestion, API, UI, observability, and manifest handling

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, verify observability dashboards)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., temporary CSV cache] | [current need] | [why Postgres replication insufficient] |
| [e.g., UI virtualization library swap] | [specific problem] | [why existing filament components insufficient] |


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
- [ ] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v1.1.0 - See `/memory/constitution.md`*
