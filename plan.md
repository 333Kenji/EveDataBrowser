# Eve Data Browser Implementation Plan

## Roadmap Overview
Phase-1 objective: ingest CCP SDE locally, normalise Ships and Blueprints into Postgres, expose FastAPI endpoints, and deliver a React filament UI for browsing. Work is organised into milestones M0–M5.

| Milestone | Goal | Target Window | Exit Criteria |
|-----------|------|---------------|---------------|
| **M0 — Repo readiness** | Stand up Docker dev environment | Week 0 | `docker compose up` starts Postgres, FastAPI stub, React dev server; `/health` returns `ok`; lint/format scripts runnable. |
| **M1 — Ingestion foundation** | Detect and ingest SDE archives | Week 1 | Watcher/CLI ingests newest archive from `data/SDE/_downloads/`; `sde_versions` populated; minimal tables created via migrations; ingestion unit tests pass; logs include import counts + checksum decisions. |
| **M2 — API delivery** | Provide searchable endpoints | Week 2 | `/search`, `/ships/{type_id}`, `/blueprints/{blueprint_type_id}` implemented with pagination, filters, manifest headers; entity card JSON contracts versioned; indexes added; contract tests green. |
| **M3 — UI browsers** | Ship & Blueprint React experiences | Week 3 | Sidebar navigation with Ships/Blueprints; search box, filters, paginated lists; Ship/Blueprint cards render JSON contract fields; background filament animation + reduced-motion toggle in place; accessibility smoke tests pass. |
| **M4 — Polish** | UX refinements & docs | Week 4 | Empty states, loading skeletons, error toasts; README quickstart updated; screenshots for browsers; logging/docs on ingest behaviour. |
| **M5 — Ops hardening** | Data hygiene & ops | Week 5 | Backup/restore script for Postgres volume; pruning policy for superseded SDE archives; performance notes (query timings, ingestion duration); CI job running format + unit tests. |

## Work Streams
1. **Ingestion** — Python watcher + CLI, YAML parsing, Postgres upsert logic.
2. **Database** — Alembic (or equivalent) migrations, indexes, attribute views, manifest tracking.
3. **FastAPI** — Read-only endpoints, schemas, validation, contract tests, logging.
4. **Frontend** — React + Vite UI, filament theming, search & filters, entity cards.
5. **Operations** — Docker compose, CI, backups, pruning, docs.

## Milestone Details
### M0 — Repo Readiness
- Create `docker/compose.yml` with services: `db`, `ingestion`, `backend`, `frontend`.
- Provide multi-stage Dockerfiles with bind mounts for dev hot reload.
- Stub FastAPI `/health` endpoint and React landing page.
- Configure lint/format tooling (ruff, black, isort, eslint, prettier) and shared `pnpm` workspace.
- Acceptance: `docker compose up` -> `/health` returns `ok`, React dev server reachable, format scripts succeed.

### M1 — Ingestion Foundation
- Implement filesystem watcher or scheduled poller for `data/SDE/_downloads/`.
- Detect newest archive (version/mtime) and skip unchanged imports via checksum.
- Expand archives, parse YAML (ships + blueprints + supporting tables), write JSON derivatives for debugging.
- Insert/Upsert into Postgres minimal schema; record manifest row in `sde_versions`.
- Provide fallback strategy when CCP static data page markup changes: configurable base URL, mirror support, and manual override instructions.
- Unit tests mocking filesystem + YAML ensure missing asset and checksum mismatch aborts.
- Logging summarises counts and statuses.

### M2 — API Delivery
- Design Pydantic schemas corresponding to entity card JSON contracts; commit contracts prior to implementation.
- Build FastAPI routers for `/search`, `/ships/{type_id}`, `/blueprints/{blueprint_type_id}`.
- Implement filtering (race/faction, group, product categories) and pagination.
- Add DB indexes (lower(name), blueprint name) and ensure queries use them.
- Contract tests assert payload shapes + headers.

### M3 — UI Browsers
- Sidebar navigation toggles between Ships/Blueprints views.
- Search box + filters wired to FastAPI endpoints (TanStack Query for caching).
- Virtualized result lists show manifest badge and summary.
- Ship Card renders hull info, slots, hardpoints, attributes; Blueprint Card renders product, activities, materials, time.
- Filament background + reduced-motion toggle integrated; theme colors match EVEIndy palette.
- Accessibility checks (keyboard traversal, color contrast, Axe rules).

### M4 — Polish
- Implement loading skeletons, empty state messaging, and toast errors for failed fetches.
- Document quickstart: ingest CLI, search examples, UI usage.
- Capture screenshots for README and tasks artifacts.
- Cleanup logs/metrics naming, ensure manifest metadata visible in UI.

### M5 — Ops Hardening
- Script to snapshot/restore Postgres data volume.
- Cron-style pruning for archives older than N manifests.
- Performance note capturing ingestion duration, query latencies under sample load.
- CI pipeline running format + tests for ingestion, backend, frontend; publish artifact with entity card JSON contracts.

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Large SDE files slow ingestion | Stream processing, chunked inserts, precomputed indexes |
| Schema drift between SDE releases | Store manifest version + checksum, log diffs, add validation tests |
| UI performance with large lists | Virtualize lists, use TanStack Query caching, enforce pagination |
| Accessibility regressions | Automate Axe checks in CI, manual keyboard testing during M3 |
| Developer environment drift | Document Docker workflows, lock dependency versions, run CI gates |

## Dependencies
- CCP SDE archive availability.
- Docker Engine + compose plugin.
- Python 3.12, Node.js 20 via container images.
- Prior EVEIndy design assets (colors, filament background component).

## Definition of Done (Phase-1)
- Latest SDE ingested, manifest recorded, and schema accessible via Postgres.
- FastAPI endpoints and JSON contracts stable and documented.
- React UI delivers browsing experience with search, filters, cards, theming, accessibility.
- CI pipeline validates format/tests; README includes quickstart.
- Backup/pruning strategy documented and scripts landed.

## Next Steps
1. Finalise milestone task breakdown (see `tasks.md`).
2. Implement M0 tasks (Docker + stubs) to unblock ingestion work.
3. Schedule regular check-ins against milestone exit criteria.
