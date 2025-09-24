<!--
Sync Impact Report
- Version: 1.0.0 → 1.1.0
- Modified Principles: Data Fidelity First; Responsive Filament UI; Technology & Experience Guardrails; Workflow & Quality Gates
- Added Sections: None
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
- Mirror the EVEIndy helper workflow: discover `.bz2` YAML links, download with retry/backoff, decompress deterministically (types → blueprints), record manifest entries with SHA-256, and fail builds if manifests or checksums diverge.

### II. Postgres As Source Of Truth
- Persist parsed data exclusively in Postgres with versioned migrations and repeatable seed scripts.
- Interact with Postgres through typed data access helpers; no feature may rely on ad-hoc SQL in application layers.
- Derived caches or search indexes must declare their Postgres dependency and invalidation strategy alongside code.

### III. Responsive Filament UI
- Ship the frontend with Vite + React + TypeScript and reuse EVEIndy's filament/node motif, typography, and palette (base `#0a0b10`, gradients blending `#22d3ee`, `#8b5cf6`, `#22c55e`).
- Provide keyboard-accessible filtering, sorting, and detail drill-down; WCAG AA contrast and focus management are mandatory.
- Integrate the animated Background Web canvas for filament ambience while keeping compositing off the main interaction layers and virtualize large result lists to maintain responsiveness.

### IV. Spec Kit Operational Discipline
- Execute every change through Plan → Spec → Tasks → Implement within this repository, committing artifacts before code merges.
- Plans and specs must articulate ingestion, Postgres, and UI implications with acceptance criteria tied to this constitution.
- No implementation merges without passing automated tests, updated documentation, and reviewer confirmation that constitutional gates are satisfied.

### V. Observable & Containerized Delivery
- Develop and run all services in Docker to keep environments reproducible across contributors and deployments.
- Emit structured logs, health endpoints, and lightweight metrics for ingestion jobs, API services, and the frontend gateway.
- Compose services (ingestion worker, API, Postgres, frontend) via `docker compose`; operational runbooks document startup, teardown, and rollback sequences.

## Technology & Experience Guardrails
- Ingestion jobs mirror the `fetch_and_load_sde` helper: discover current SDE links, download with resume support, decompress `.bz2` archives, and store SHA-256-manifested artifacts under `data/sde/_downloads/` plus JSON derivatives (`type_ids.json`, `blueprints.json`, `structures.json`).
- The importer writes manifests capturing version + checksum; migrations expose tables (`type_ids`, `blueprints`, `industry_materials`, `structures`, `rigs`) refreshed via typed data helpers so downstream queries stay scoped to Postgres.
- The API layer uses Node.js with Express (or a minimal equivalent) to expose read-only endpoints supporting pagination, filtering, search, and manifest-aware dataset versions in responses.
- The client is a Vite + React + TypeScript single-page app that reuses EVEIndy layouts (sidebar shell, pane grid, filament cards) with Background Web overlays, card gradients, and CSS tokens (`--bg`, `--fg`, `--muted`, `--purple`, `--blue`, `--green`).
- Styling uses Tailwind or CSS-in-JS while preserving EVEIndy's motif; background effects run on their own canvas layer with throttled animation.
- State management relies on TanStack Query (or an equivalent) to synchronize server data; bespoke global stores require documented justification.
- Docker images use multi-stage builds; `docker compose` orchestrates ingestion, API, Postgres, and frontend containers while mounting `data/sde/` as a named volume for reproducible caching.

## Workflow & Quality Gates
- CI pipelines validate ingestion parsers with representative SDE fixtures, assert manifest diffs, run database migrations, lint, type-check, and execute frontend tests (including Background Web accessibility fallbacks).
- Every merge updates relevant Spec Kit artifacts (plan/spec/tasks) and documentation when ingestion schemas, manifest expectations, or UI flows change.
- Reviews confirm accessibility (keyboard navigation, contrast), data accuracy (spot-check imported records against manifest), and design parity with EVEIndy's filament experience prior to approval.
- Release procedures tag Docker images, apply database migrations, refresh seeds, rotate manifests, and record rollback steps within the tasks template.

## Governance
- This constitution supersedes all prior Eve Data Browser process documents; amendments require a plan/spec pair that details impact, an updated Sync Impact Report, and reviewer approval.
- Versioning follows semantic rules: MAJOR for breaking principle changes, MINOR for new principles or sections, PATCH for clarifications. Record justifications in the Sync Impact Report.
- Compliance reviews block merges when principles, guardrails, or workflow gates are unmet; non-compliant work is reverted or prevented from deployment.

**Version**: 1.1.0 | **Ratified**: 2025-09-23 | **Last Amended**: 2025-09-23
