<!--
Sync Impact Report
- Version: — → 1.0.0
- Modified Principles: Data Fidelity First; Postgres As Source Of Truth; Responsive Filament UI; Spec Kit Operational Discipline; Observable & Containerized Delivery
- Added Sections: Technology & Experience Guardrails; Workflow & Quality Gates
- Removed Sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ updated
  - .specify/templates/spec-template.md: ✅ updated
  - .specify/templates/tasks-template.md: ✅ updated
- Follow-up TODOs: None
-->

# Eve Data Browser Constitution

## Core Principles

### I. Data Fidelity First (NON-NEGOTIABLE)
- Accept Eve SDE ZIP archives sourced from CCP's authoritative distribution only.
- Treat every ingestion run as reproducible: checksum inputs, capture importer version, and persist run metadata.
- Fail builds when schema validation emits warnings or missing mapping coverage. Migration notes and fixture updates accompany parser changes.

### II. Postgres As Source Of Truth
- Persist parsed data exclusively in Postgres with versioned migrations and repeatable seed scripts.
- Interact with Postgres through typed data access helpers; no feature may rely on ad-hoc SQL in application layers.
- Derived caches or search indexes must declare their Postgres dependency and invalidation strategy alongside code.

### III. Responsive Filament UI
- Ship the frontend with Vite + React + TypeScript and reuse EVEIndy's filament/node motif, typography, and palette (#0a0f1c base, neon cyan accents).
- Provide keyboard-accessible filtering, sorting, and detail drill-down; WCAG AA contrast and focus management are mandatory.
- Defer heavy dataset rendering to virtualized or chunked strategies so primary interactions stay responsive under production-sized data loads.

### IV. Spec Kit Operational Discipline
- Execute every change through Plan → Spec → Tasks → Implement within this repository, committing artifacts before code merges.
- Plans and specs must articulate ingestion, Postgres, and UI implications with acceptance criteria tied to this constitution.
- No implementation merges without passing automated tests, updated documentation, and reviewer confirmation that constitutional gates are satisfied.

### V. Observable & Containerized Delivery
- Develop and run all services in Docker to keep environments reproducible across contributors and deployments.
- Emit structured logs, health endpoints, and lightweight metrics for ingestion jobs, API services, and the frontend gateway.
- Compose services (ingestion worker, API, Postgres, frontend) via `docker compose`; operational runbooks document startup, teardown, and rollback sequences.

## Technology & Experience Guardrails
- Ingestion jobs decompress Eve SDE ZIPs, parse YAML with a deterministic schema binder, and write audited snapshots to Postgres.
- The API layer uses Node.js with Express (or a minimal equivalent) to expose read-only endpoints supporting pagination, filtering, and search.
- The client is a Vite + React + TypeScript single-page app with reusable filament/node components, dark-mode first, responsive down to 768px viewports.
- Styling uses Tailwind or CSS-in-JS while preserving EVEIndy's filament/node motif and color system.
- State management relies on TanStack Query (or an equivalent) to synchronize server data; bespoke global stores require documented justification.
- Docker images use multi-stage builds; `docker compose` orchestrates ingestion, API, Postgres, and frontend containers for local and production parity.

## Workflow & Quality Gates
- CI pipelines validate ingestion parsers with representative SDE fixtures, run database migrations, lint, type-check, and execute frontend tests.
- Every merge updates relevant Spec Kit artifacts (plan/spec/tasks) and documentation when ingestion schemas or UI flows change.
- Reviews confirm accessibility (keyboard navigation, contrast) and data accuracy (spot-check imported records) prior to approval.
- Release procedures tag Docker images, apply database migrations, refresh seeds, and record rollback steps within the tasks template.

## Governance
- This constitution supersedes all prior Eve Data Browser process documents; amendments require a plan/spec pair that details impact, an updated Sync Impact Report, and reviewer approval.
- Versioning follows semantic rules: MAJOR for breaking principle changes, MINOR for new principles or sections, PATCH for clarifications. Record justifications in the Sync Impact Report.
- Compliance reviews block merges when principles, guardrails, or workflow gates are unmet; non-compliant work is reverted or prevented from deployment.

**Version**: 1.0.0 | **Ratified**: 2025-09-23 | **Last Amended**: 2025-09-23
