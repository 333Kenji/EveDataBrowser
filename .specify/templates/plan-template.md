# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Eve Data Browser scope: ingestion, API, frontend
   → Capture Eve SDE dataset touchpoints, Postgres implications, and frontend surface area
3. Populate the Constitution Check section using Eve Data Browser constitution v1.0.0
   → Map each principle to measurable gating questions
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking with mitigation
   → If no justification possible: ERROR "Realign with constitution before proceeding"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → Resolve unknowns about SDE schema, dataset cadence, Postgres migrations, UI access patterns
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `.specify/scripts/bash/update-agent-context.sh codex`)
   → Ensure contracts cover ingestion jobs, API read endpoints, and UI interactions required to browse data
7. Re-evaluate Constitution Check section
   → If new violations: Refine design, return to Phase 1 deliverables
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → Highlight Docker touchpoints, observability hooks, and testing strategy for ingestion/API/UI
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context
**Language/Version**: [e.g., Node.js 20, Python 3.12 for ingestion, React 18 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., Vite, Express, TanStack Query or NEEDS CLARIFICATION]  
**Storage**: PostgreSQL (version?) or NEEDS CLARIFICATION  
**Testing**: [e.g., Vitest, Jest, pytest, Supertest or NEEDS CLARIFICATION]  
**Target Platform**: Dockerized web stack (frontend, API, ingestion) or NEEDS CLARIFICATION  
**Project Type**: web (frontend + backend + ingestion worker)  
**Performance Goals**: [e.g., dataset render <500ms, ingestion per archive <5 min or NEEDS CLARIFICATION]  
**Constraints**: [e.g., read-only API, WCAG AA, memory ceilings or NEEDS CLARIFICATION]  
**Scale/Scope**: [e.g., full SDE snapshot, concurrent viewers, ingestion frequency or NEEDS CLARIFICATION]
**Ingestion Cadence**: [e.g., nightly, on-demand or NEEDS CLARIFICATION]  
**Observability**: [logging/metrics expectations or NEEDS CLARIFICATION]

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] **Data Fidelity First**: Ingestion path validates SDE source, schemas, and checksum logging.
- [ ] **Postgres As Source Of Truth**: Plan documents migrations, seeds, and typed data helpers without shadow stores.
- [ ] **Responsive Filament UI**: UI scope covers filament/node styling, accessibility, and performance guardrails.
- [ ] **Spec Kit Operational Discipline**: Plan references required Spec Kit artifacts, testing cadence, and reviewer gates.
- [ ] **Observable & Containerized Delivery**: Docker story, structured logging, health endpoints, and metrics are accounted for.

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

docker/
├── Dockerfile.*
└── compose.yml
```

**Structure Decision**: Default to the above stack unless Technical Context indicates a scoped subset (e.g., UI-only spike). Document deviations.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research ingestion/API/UI specifics
   - For each dependency → capture version support inside Docker
   - For schema questions → document required SDE references

2. **Generate and dispatch research tasks**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for Eve Data Browser {feature}"
   For each technology choice:
     Task: "Summarize best practices for {tech} in Eve Data Browser context"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved and constitution gates satisfied

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Model data & ingestion artifacts** in `data-model.md`:
   - Entities, fields, relationships, and provenance metadata
   - Ingestion run states and error handling

2. **Generate API contracts** for browsing features:
   - For each user filter/search → endpoint + response schema
   - Capture pagination, sorting, and Postgres-backed queries

3. **Generate contract tests** from contracts:
   - One test file per endpoint or ingestion pipeline contract
   - Tests must fail (no implementation yet) and assert Postgres fixtures

4. **Extract test scenarios** from user stories:
   - Browser interactions, accessibility checks, ingestion updates
   - Quickstart test = end-to-end data visibility scenario

5. **Update agent context**:
   - Run `.specify/scripts/bash/update-agent-context.sh codex`
   - Add new technologies or decisions since last update
   - Keep under 150 lines for token efficiency

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Ingestion pipelines → parser + migration tasks [P]
- API endpoints → contract tests then Express handlers [P]
- UI flows → component tests then implementation tasks

**Ordering Strategy**:
- Setup Docker + Postgres → Tests → Ingestion → API → UI → Observability
- Mark [P] for independent files/services only

**Estimated Output**: 30±5 numbered, ordered tasks in tasks.md covering ingestion, API, UI, and observability

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
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
