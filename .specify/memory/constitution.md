<!--
Sync Impact Report
- Version: 1.1.0 → 1.2.0
- Modified Principles: Data Fidelity First; Postgres As Source Of Truth; Responsive Filament UI; Technology & Experience Guardrails; Workflow & Quality Gates
- Added Sections: None
- Removed Sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md: ⚠ pending (sync FastAPI + Phase-1 scope)
  - .specify/templates/spec-template.md: ⚠ pending (ships/blueprints emphasis)
  - .specify/templates/tasks-template.md: ⚠ pending (milestone alignment)
- Follow-up TODOs: None
-->

# Eve Data Browser Constitution

## Core Principles

### I. Data Fidelity First (NON-NEGOTIABLE)
- Accept Eve SDE ZIP archives sourced from CCP's authoritative distribution or manually provided via `data/SDE/_downloads/` only.
- Auto-detect the newest archives, compute SHA-256 checksums, capture importer version, and persist manifest metadata for every run.
- Mirror the proven EVEIndy helper workflow: deterministically decompress `.bz2` YAML (types → blueprints), verify inputs, and fail builds if required assets or checksums diverge.

### II. Postgres As Source Of Truth
- Persist parsed data exclusively in Postgres with versioned migrations and repeatable seed scripts covering Phase-1 entities (ships and blueprints) plus supporting lookup tables.
- Interact with Postgres through typed data access helpers; no feature may rely on ad-hoc SQL in application layers.
- Derived caches or search indexes must declare their Postgres dependency, invalidation strategy, and provenance alongside code.

### III. Responsive Filament UI
- Deliver the frontend with Vite + React + TypeScript, reusing EVEIndy's filament/node motif, typography, and palette (base `#0a0b10`, gradients blending `#22d3ee`, `#8b5cf6`, `#22c55e`).
- Provide keyboard-accessible search, filtering, and detail drill-down for Ships and Blueprints; WCAG AA contrast, focus management, and reduced-motion alternatives are mandatory.
- Integrate the animated Background Web canvas without blocking interactions, virtualize result lists, and surface manifest metadata on every entity card.

### IV. Spec Kit Operational Discipline
- Execute every change through Plan → Spec → Tasks → Implement within this repository, committing artifacts before code merges.
- Plans and specs must articulate ingestion, Postgres, API, and UI implications with acceptance criteria tied to this constitution.
- No implementation merges without passing automated tests, updated documentation, and reviewer confirmation that constitutional gates are satisfied.

### V. Observable & Containerized Delivery
- Develop and run all services in Docker to keep environments reproducible across contributors and deployments.
- Emit structured logs, health endpoints, and lightweight metrics for ingestion jobs, FastAPI services, and the frontend gateway.
- Compose services (ingestion worker, FastAPI backend, Postgres, frontend) via `docker compose`; operational runbooks document startup, teardown, pruning, and rollback sequences.

## Technology & Experience Guardrails
- **Phase-1 scope**: Local SDE → Postgres → React browser for Ships and Blueprints only. Search by display name, not type ID. No job planning, profitability calculators, or ESI integrations in this repo.
- Market data limited to The Forge (Jita) region using public Adam4EVE and Fuzzwork endpoints; rate limits respected and snapshots persisted to Postgres.
- Ingestion watches `data/SDE/_downloads/` (case-insensitive) for the newest archive, verifies versions/checksums, skips unchanged imports, and logs every decision. Parsed data is limited to minimal CCP tables plus attribute mappings required for ship stats and blueprint activities.
- The importer writes manifests (`sde_versions`) capturing version, checksum, and import timestamps; migrations expose `invTypes`, `invGroups`, `invCategories`, `invBlueprintTypes`, `industryActivity`, `industryActivityMaterials`, `industryActivityProducts`, preset tables derived from the SDE (faction/race/group metadata), and related attribute views needed for entity cards.
- The backend uses FastAPI to provide read-only endpoints (`/health`, `/search`, `/ships/{type_id}`, `/blueprints/{blueprint_type_id}`) with pagination, filters, and manifest-aware headers. Entity card JSON contracts for ships and blueprints MUST be produced and versioned before or alongside endpoint changes so the frontend can develop against a stable schema.
- The React + Vite client ships with a sidebar (Ships / Blueprints), filament background, reusable card templates, search box, results list, and detail panes. Front-end vision includes:
  - Right-side market browser panel with unified search; selecting an item renders a type-specific card.
  - Ship card presented as modern, multi-tab layout (Stats, Fitting/Slots, Description, Attributes) with lightweight 3D viewer (progressive enhancement) and reduced-motion fallback delivering subtle factory ambiance.
  - Blueprint card split between calculator (materials, activity buttons for Manufacturing/Research/Invention) and market stats panel.
  - Animated filaments/nodes background providing depth/parallax without blocking interactions. See `specify.md` for component-level details.
- State management relies on TanStack Query (or an equivalent) to synchronize server data; bespoke global stores require documented justification.
- Docker images rely on multi-stage builds; `docker compose` orchestrates ingestion (CLI + watcher), FastAPI backend, Postgres, and frontend containers with a shared `data-sde` named volume.
- Market data management scope (Phase-1): integrate provider adapters (Adam4EVE first, Fuzzwork later), honour rate limits via shared limiter, capture snapshots/incremental updates in Postgres, and expose `/market/:type_id` API for UI charts. Detailed schema and cadence live in `specify.md`.
- Phase-1 non-goals: no ESI job planner, profitability calculators, or advanced simulations. 3D viewer remains optional behind feature flag with graceful fallback imagery.

## Workflow & Quality Gates
- CI pipelines validate ingestion parsers with representative SDE fixtures, assert manifest diffs, run database migrations, lint, format, execute backend unit tests, and run frontend/UI accessibility tests.
- Every merge updates relevant Spec Kit artifacts (specify/plan/tasks) and documentation when ingestion schemas, manifest expectations, or UI flows change. Entity card JSON contracts must be updated in lockstep with API adjustments.
- Reviews confirm accessibility (keyboard navigation, contrast, reduced-motion), data accuracy (spot-check imported records against manifest), and adherence to the filament visual language before approval.
- Release procedures tag Docker images, apply database migrations, refresh seeds, prune superseded SDE archives, and record rollback steps within the tasks template.

## Governance
- This constitution supersedes all prior Eve Data Browser process documents; amendments require a plan/spec pair that details impact, an updated Sync Impact Report, and reviewer approval.
- Versioning follows semantic rules: MAJOR for breaking principle changes, MINOR for new principles or sections, PATCH for clarifications. Record justifications in the Sync Impact Report.
- Compliance reviews block merges when principles, guardrails, or workflow gates are unmet; non-compliant work is reverted or prevented from deployment.

**Version**: 1.2.0 | **Ratified**: 2025-09-23 | **Last Amended**: 2025-09-23
