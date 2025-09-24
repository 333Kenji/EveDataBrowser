# Eve Data Browser Implementation Plan

## Roadmap Overview
Phase-1 objective: deliver a polished Eve-inspired browser that ingests local SDE archives, serves FastAPI endpoints, and presents cinematic ship/blueprint experiences with market insight. Work is organised into milestones M0–M5.

| Milestone | Goal | Target Window | Exit Criteria |
|-----------|------|---------------|---------------|
| **M0 — Ingestion Foundation** | Solidify SDE ingest, schema, presets | Week 0 | Watcher/CLI ingests newest archive; `sde_versions` + core tables populated; presets/invention tables generated; ingestion tests/logs green. |
| **M1 — Theme & Shell** | Establish sidebar layout, global search skeleton, filaments background, and design tokens | Week 1 | App loads with right sidebar + grouped search stub, tokens applied, filaments animation within perf/a11y budgets. |
| **M2 — Ship Browser** | Ship search + detail experience with optional 3D | Week 2 | `/search` + `/ships/:id` live; ShipCard tabs populated; attribute/slot mapping complete; 3D viewer behind feature flag with fallback image. |
| **M3 — Blueprint Browser** | Blueprint calculator + market stats split view | Week 3 | `/blueprints/:id` live; split card renders materials/time from SDE; activity buttons active; mock market stats displayed. |
| **M4 — Market Data (MVP)** | Scaffold market data model + mock API | Week 4 | `market_snapshots` schema + rate limiter ready; provider adapters produce Forge mock data; `/market/:type_id` returns synthetic 7/30d series; UI chart consumes mock path. |
| **M5 — Market Data (Live)** | Integrate Adam4EVE with incremental updates | Week 5 | Live adapter populates Forge snapshots respecting rate limits; incremental scheduler running; chart shows latest 7/30d live data; retention/pruning job active. |
| **M6 — Polish & Perf** | Finalise accessibility, performance, docs, CI | Week 6 | Reduced motion + lazy loading done; skeletons/error toasts active; README/docs/CI updated; perf budgets met (TTI ≤2s, bundle <250KB gz sans three.js). |

## Work Streams
1. **Ingestion** — Watcher/CLI, schema migrations, presets, invention data.
2. **Front-End Shell** — Sidebar, search, design tokens, background animation.
3. **Ships** — Attribute mapping, ShipCard tabs, 3D viewer flag.
4. **Blueprints** — Calculator layout, market stats panel, blueprint-specific filters.
5. **Market Data** — Provider adapters, rate limiting, Forge-only snapshots, chart API.
6. **Ops & Perf** — CI, docs, reduced motion, lazy loading, retention jobs.

## Milestone Details
### M0 — Ingestion Foundation
- Implement filesystem watcher or poller for `data/SDE/_downloads/` with checksum skip + manifest logging.
- Run migrations creating core SDE tables, preset tables, blueprint invention, and supporting indexes.
- Extend ingestion pipeline to populate presets/invention data alongside JSON derivatives.
- Verify ingestion unit tests (missing asset, checksum mismatch) and update quickstart docs.

### M1 — Theme & Shell
- Implement right sidebar navigation with unified search scaffold and grouped result placeholder.
- Define design tokens (colors, spacing, radii, shadows, typography) and apply to layout components.
- Implement filaments/nodes animated background respecting ≤3% CPU and `prefers-reduced-motion`.
- Ensure routing skeleton renders EntityCard frame; verify keyboard navigation/a11y baseline.

### M2 — Ship Browser
- Complete `/search` endpoint returning grouped ships/blueprints and expose grouped response to UI.
- Map SDE attributes (slots, hardpoints, rigs, cpu/pg, mass, volume) to ShipCard contract.
- Derive preset tables (faction, race, group, category) from SDE during import for theming/filter defaults.
- Implement ShipCard tabs (Stats, Slots, Description, Attributes) and integrate optional Three.js viewer behind `FEATURE_SHIP_3D` with fallback imagery and controls guidance.
- Validate reduced-motion flow (disable animation/3D) and a11y (ARIA tabs, keyboard navigation).

### M3 — Blueprint Browser
- Deliver `/blueprints/{blueprint_type_id}` endpoint with materials/time data, activities flags, invention placeholders.
- Build BlueprintCard split layout: Calculator top (materials/time/runs, activity buttons row), MarketStats bottom (mock price/volume panel).
- Link blueprint product back to ship card and ensure filters (product category/activity presence) function.

### M4 — Market Data (MVP)
- Create `market_snapshots` table and shared rate limiter module.
- Scaffold provider adapters (Adam4EVE live stub, Fuzzwork placeholder) capable of returning mock time-series data since last timestamp.
- Implement `/market/{type_id}?provider=&window=` API returning synthetic 7/30d series; UI chart consumes endpoint and highlights BOM selections.
- Document provider endpoints, rate limits, payload formats, and confirm Forge-only scope in `docs/data/market.md`.

### M5 — Market Data (Live)
- Implement Adam4EVE adapter with incremental fetch, backoff, and retention configuration.
- Schedule background task for periodic updates + pruning of snapshots older than configured window.
- Replace mock data path with live chart data; expose provider/window controls; monitor rate limit metrics.
- Maintain Fuzzwork adapter behind feature flag pending future activation.

### M6 — Polish & Perf
- Lazy-load heavy components (3D viewer, market chart), code-split bundles (<250KB gz without three.js).
- Add skeletons, empty/error states, toast notifications; ensure reduced motion + parallax controls documented.
- Update README, `docs/ui/styleguide.md`, `docs/data/market.md`; enhance CI (lint/tests/contracts/perf smoke).

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Filament animation impacts performance | throttle animation, pause on hidden tab, obey reduced motion |
| 3D viewer heavy on low-end devices | gate behind `FEATURE_SHIP_3D`, provide static fallback |
| Market providers enforce strict rate limits | central RateLimiter with jittered backoff, monitor usage |
| Mock-to-live swap introduces schema drift | maintain contract tests for `/market`, stage adapters with feature flags |
| UI accessibility regressions | automated Axe audits, manual keyboard testing per milestone |

## Dependencies
- Local CCP SDE dump in `data/SDE/_downloads/`.
- Adam4EVE API access (public endpoints) and future Fuzzwork endpoints.
- Docker Engine + compose plugin; Node.js 20 + Python 3.12 in containers.
- 3D ship assets (glTF placeholders) and faction lighting presets.

## Definition of Done (Phase-1)
- Latest SDE ingested, manifest recorded, and schema accessible via Postgres.
- FastAPI endpoints (`/search`, `/ships/:id`, `/blueprints/:id`, `/market/:type_id`) stable with JSON contracts documented.
- React UI delivers ship/blueprint browsers with cinematic cards, filters, charts, and accessibility support.
- Market data adapters ingest snapshots with retention + rate limiting; UI charts reflect data.
- CI/Docs updated (styleguide, market plan, README); perf budgets satisfied.

## Change Management
- Any modification to this implementation plan or to `specify.md` REQUIRES re-evaluating task coverage.
- Re-run the `/tasks` flow (or manually extend `tasks.md`) so every new/changed requirement is backed by actionable work before implementation begins.
- Reviewers MUST compare plan/spec diffs against the task backlog and block merges when coverage gaps remain.

## Next Steps
1. Align milestone tasks (see `tasks.md`).
2. Implement M0 tasks (sidebar/search/theme) to unlock ship browser work.
3. Schedule weekly reviews to ensure milestones hit exit criteria.
