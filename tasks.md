# Tasks: Eve Data Browser Phase-1

All tasks map to milestones M0–M7 from `plan.md`. Each task lists actionable sub-steps, execution notes, file references, and dependencies.

## Legend
- **Sub-steps**: Ordered checklist to complete the task.
- **Notes**: Tips, assumptions, or guardrails.
- **Depends on**: Upstream task IDs that must finish first (omit if none).

## Milestone M0 — Repo Readiness
- [ ] **M0-T01 Bootstrap Docker compose stack** (`docker/compose.yml`, `docker/.env.example`)
  - **Sub-steps**: (a) Define services `db`, `ingestion`, `backend`, `frontend`, shared `data-sde` named volume; (b) Wire environment variables via `.env.example`; (c) Add healthcheck placeholders for backend/frontend.
  - **Notes**: Use Postgres 15 base image; ensure volume mount for `data/SDE/_downloads/` so manual SDE archives are visible to containers.
- [ ] **M0-T02 Author multi-stage Dockerfiles** (`docker/Dockerfile.ingestion`, `docker/Dockerfile.backend`, `docker/Dockerfile.frontend`)
  - **Sub-steps**: (a) Stage 1 install deps; (b) Stage 2 copy minimal runtime; (c) Support dev bind mounts; (d) Document build args in README.
  - **Notes**: Align Python 3.12 for ingestion/backend; Node 20 for frontend; keep image sizes minimal.
  - **Depends on**: M0-T01.
- [ ] **M0-T03 Scaffold tooling & lint** (`pyproject.toml`, `Makefile`, `package.json`)
  - **Sub-steps**: (a) Configure ruff, black, mypy for Python; (b) Configure eslint, prettier, vitest for frontend; (c) Add Make targets `make lint`, `make test` that run inside containers.
  - **Notes**: Ensure `docker compose run --rm backend make lint` succeeds.
  - **Depends on**: M0-T02.
- [ ] **M0-T04 Stub FastAPI app** (`backend/src/main.py`, `backend/src/api/health.py`, `backend/tests/test_health_smoke.py`)
  - **Sub-steps**: (a) Create FastAPI app factory; (b) Implement `/health` route returning `{status:"ok"}`; (c) Add pytest smoke test; (d) Update compose command to run `uvicorn`.
  - **Notes**: Keep file layout consistent with plan (FastAPI, not Express).
  - **Depends on**: M0-T02, M0-T03.
- [ ] **M0-T05 Document SDE archive handling** (`README.md`, `.gitignore`, `tasks.md` note)
  - **Sub-steps**: (a) Ensure `.gitignore` excludes `data/SDE/_downloads/*.zip` and `docs/data/*.zip`; (b) Update README setup to instruct manual placement; (c) Reference this in tasks.
  - **Notes**: Prevent accidental commits of large CCP data.
  - **Depends on**: M0-T01.

## Milestone M1 — Ingestion Foundation
- [ ] **M1-T01 Watcher & manifest discovery** (`ingestion/src/watcher.py`, `ingestion/tests/test_watcher.py`)
  - **Sub-steps**: (a) Implement poller scanning `data/SDE/_downloads/`; (b) Compute checksum & version from filename/manifest; (c) Emit event queue entry when new archive detected; (d) Cover with pytest for new/duplicate files.
  - **Notes**: Use `pathlib`; guard against partial downloads.
  - **Depends on**: M0-T01, M0-T05.
- [ ] **M1-T02 Decompression + manifest writer** (`ingestion/src/pipeline.py`, `ingestion/tests/test_manifest_pipeline.py`)
  - **Sub-steps**: (a) Decompress `.bz2`; (b) Generate SHA-256; (c) Write `sde_versions` row; (d) Persist JSON derivatives to `data/sde/`.
  - **Notes**: Ensure idempotent reruns skip unchanged archives; reuse hashed temp directories.
  - **Depends on**: M1-T01.
- [ ] **M1-T03 Schema migrations** (`backend/src/db/migrations/V001__sde_tables.py`)
  - **Sub-steps**: (a) Create tables for manifests, ships, ship presets, dogma attributes/values, blueprints, blueprint skills, industry materials/products; (b) Add indexes noted in `data-model.md` for these entities.
  - **Notes**: Use Alembic autogenerate for baseline then hand-edit naming; include `downgrade` logic.
  - **Depends on**: M0-T02.
- [ ] **M1-T04 Data loaders** (`ingestion/src/dogma.py`, `ingestion/src/blueprints.py`, `ingestion/tests/test_dogma_join.py`)
  - **Sub-steps**: (a) Join `typeDogma` → `dogmaAttributes` → `dogmaUnits`; (b) Map blueprint activities, skills, invention metadata; (c) Validate via fixtures.
  - **Notes**: Keep memory footprint manageable by streaming YAML; reuse zipped SDE sample fixtures.
  - **Depends on**: M1-T02, M1-T03.
- [ ] **M1-T05 Quickstart updates** (`docs/quickstart.md`)
  - **Sub-steps**: (a) Document manual SDE drop; (b) Provide ingestion CLI command; (c) Explain verifying manifest row; (d) Mention `.gitignore` enforcement.
  - **Notes**: Reference tasks to keep instructions consistent.
  - **Depends on**: M1-T02.

## Milestone M2 — Theme & Shell
- [ ] **M2-T01 Design tokens** (`frontend/src/styles/tokens.ts`, `docs/ui/styleguide.md`)
  - **Sub-steps**: (a) Export color palette, typography, spacing; (b) Update styleguide doc with usage; (c) Add unit snapshot for tokens.
  - **Notes**: Match constitution gradient palette (#0a0b10 base, #22d3ee/#8b5cf6/#22c55e accents).
  - **Depends on**: M0-T03.
- [ ] **M2-T02 Sidebar navigation** (`frontend/src/components/Sidebar.tsx`, `frontend/tests/components/Sidebar.spec.tsx`)
  - **Sub-steps**: (a) Render Ships/Blueprints links; (b) Sync selection with router param; (c) Add keyboard focus tests.
  - **Notes**: Provide aria attributes for nav landmarks.
  - **Depends on**: M0-T04.
- [ ] **M2-T03 Search skeleton** (`frontend/src/components/SearchShell.tsx`, `frontend/src/hooks/useSearchParams.ts`)
  - **Sub-steps**: (a) Wire global search input; (b) Stub results list with placeholders; (c) Ensure manifest badge placeholder ready.
  - **Notes**: Use TanStack Query for eventual data fetch; initial stub returns static data.
  - **Depends on**: M2-T02.
- [ ] **M2-T04 Background filaments** (`frontend/src/components/BackgroundWeb.tsx`, `frontend/tests/components/BackgroundWeb.spec.tsx`)
  - **Sub-steps**: (a) Integrate animation; (b) Respect `prefers-reduced-motion`; (c) Provide toggle hook; (d) Add FPS/perf test harness.
  - **Notes**: Keep CPU < 3% on dev machine; degrade gracefully.
  - **Depends on**: M2-T01.

## Milestone M3 — Ship Browser
- [ ] **M3-T01 `/search` endpoint** (`backend/src/api/search.py`, `backend/tests/test_search.py`)
  - **Sub-steps**: (a) Accept entity filter; (b) Query repository; (c) Include manifest headers; (d) Cover pagination in tests.
  - **Notes**: Use async SQLAlchemy; return grouped payload matching contracts.
  - **Depends on**: M1-T03, M1-T04.
- [ ] **M3-T02 Ship repository helpers** (`backend/src/db/repository.py`, `backend/tests/test_repository_ships.py`)
  - **Sub-steps**: (a) Expose ship query with joins to presets, dogma values; (b) Provide filter helpers for faction/race/group.
  - **Notes**: Align with `data-model.md` fields.
  - **Depends on**: M1-T03, M1-T04.
- [ ] **M3-T03 ShipCard UI** (`frontend/src/components/cards/ShipCard.tsx`, `frontend/tests/components/ShipCard.spec.tsx`)
  - **Sub-steps**: (a) Render Stats/Slots/Attributes tabs; (b) Integrate manifest badge; (c) Connect to `/ships/:id` data hook.
  - **Notes**: Provide fallback image when 3D viewer disabled.
  - **Depends on**: M3-T01, M3-T02, M2-T03.
- [ ] **M3-T04 Optional 3D viewer** (`frontend/src/components/cards/ShipViewer.tsx`, `frontend/src/assets/ships/manifest.json`)
  - **Sub-steps**: (a) Load glTF assets lazily; (b) Add feature flag; (c) Provide control hints and accessibility alt text.
  - **Notes**: Keep bundle size budget, load behind dynamic import.
  - **Depends on**: M3-T03.

## Milestone M4 — Blueprint Browser
- [ ] **M4-T01 Blueprint repository helpers** (`backend/src/db/repository.py`, `backend/tests/test_repository_blueprints.py`)
  - **Sub-steps**: (a) Query activities/materials/products/skills; (b) Compose contract payload; (c) Add caching hints.
  - **Notes**: Use same manifest filter as ships.
  - **Depends on**: M1-T03, M1-T04.
- [ ] **M4-T02 `/blueprints/:id` endpoint** (`backend/src/api/blueprints.py`, `backend/tests/test_blueprints.py`)
  - **Sub-steps**: (a) Return full BlueprintCard payload; (b) Handle 404s; (c) Inject manifest headers.
  - **Notes**: Keep response consistent with contract JSON stored in `backend/contracts/entities.json`.
  - **Depends on**: M4-T01.
- [ ] **M4-T03 BlueprintCard UI** (`frontend/src/components/cards/BlueprintCard.tsx`, `frontend/tests/components/BlueprintCard.spec.tsx`)
  - **Sub-steps**: (a) Render calculator with BOM grid; (b) Provide activity buttons; (c) Display mock market stats panel (placeholder data from local JSON).
  - **Notes**: Connect to `/blueprints/:id`; share filter controls with ship view.
  - **Depends on**: M2-T03, M4-T02.
- [ ] **M4-T04 Filters integration** (`frontend/src/components/Filters.tsx`, `frontend/tests/components/Filters.spec.tsx`)
  - **Sub-steps**: (a) Build shared filter component; (b) Sync query params; (c) Call search API with filter args.
  - **Notes**: Provide accessible multi-select controls.
  - **Depends on**: M3-T01, M4-T03.

## Milestone M5 — Market Data (MVP)
- [ ] **M5-T01 Market schema + rate limiter** (`backend/src/db/migrations/V002__market_tables.py`, `backend/src/services/rate_limiter.py`)
  - **Sub-steps**: (a) Create follow-up migration for `market_snapshots` table + supporting indexes; (b) Implement token-bucket limiter with jitter.
  - **Notes**: Config defaults 30 requests/minute from research doc.
  - **Depends on**: M1-T03.
- [ ] **M5-T02 Provider stubs** (`ingestion/src/market/adam4eve_stub.py`, `ingestion/src/market/fuzzwork_stub.py`, `ingestion/tests/test_market_stub.py`)
  - **Sub-steps**: (a) Return deterministic mock series; (b) Respect limiter; (c) Unit tests for windows 7/30 day.
  - **Notes**: Document endpoints and TODOs in `docs/data/market.md`.
  - **Depends on**: M5-T01.
- [ ] **M5-T03 `/market/{type_id}` endpoint** (`backend/src/api/market.py`, `backend/tests/test_market.py`)
  - **Sub-steps**: (a) Serve mock data; (b) Validate provider/window params; (c) Include manifest + provider headers.
  - **Notes**: Provide caching hints via ETag.
  - **Depends on**: M5-T02.
- [ ] **M5-T04 Market chart UI** (`frontend/src/components/cards/BlueprintMarketChart.tsx`, `frontend/tests/components/BlueprintMarketChart.spec.tsx`)
  - **Sub-steps**: (a) Visualise 7/30-day series; (b) Highlight BOM hover; (c) Show provider badge.
  - **Notes**: Use charting lib with reduced-motion fallback.
  - **Depends on**: M5-T03, M4-T03.

## Milestone M6 — Market Data (Live)
- [ ] **M6-T01 Adam4EVE live adapter** (`ingestion/src/market/adam4eve.py`, `ingestion/tests/test_market_live.py`)
  - **Sub-steps**: (a) Call live API; (b) Handle pagination/backoff; (c) Persist new snapshots only; (d) Log rate usage.
  - **Notes**: Reuse limiter config; store raw payload in JSON column as per data model.
  - **Depends on**: M5-T02, M1-T03.
- [ ] **M6-T02 Scheduler + retention** (`ingestion/src/scheduler.py`, `docker/entrypoints/cron.sh`, `ingestion/tests/test_scheduler.py`)
  - **Sub-steps**: (a) Implement cadence (default 30 min with jitter); (b) Add pruning job for >90 day data; (c) Ensure manual trigger supported.
  - **Notes**: Document schedule in `docs/data/market.md`.
  - **Depends on**: M6-T01.
- [ ] **M6-T03 Live chart integration** (`frontend/src/components/cards/BlueprintMarketChart.tsx`, `frontend/tests/components/BlueprintMarketChart.live.spec.tsx`)
  - **Sub-steps**: (a) Flip feature flag to live data; (b) Add provider/window controls; (c) Update tests to use recorded fixtures.
  - **Notes**: Keep graceful fallback to mock path for offline dev.
  - **Depends on**: M6-T01, M5-T04.

## Milestone M7 — Polish & Perf
- [ ] **M7-T01 Lazy loading & code splitting** (`frontend/vite.config.ts`, `frontend/src/routes/*.tsx`)
  - **Sub-steps**: (a) Configure dynamic imports for heavy components; (b) Verify bundle size; (c) Update perf docs.
  - **Notes**: Ensure 3D viewer + chart only load when needed.
  - **Depends on**: M3-T04, M5-T04.
- [ ] **M7-T02 Skeletons, error states, toasts** (`frontend/src/components/states/*`, `frontend/tests/components/States.spec.tsx`)
  - **Sub-steps**: (a) Implement skeletons for search/cards; (b) Add toast provider; (c) Cover with accessibility tests.
  - **Notes**: Keep copy aligned with specify.md tone.
  - **Depends on**: M3-T03, M4-T03, M5-T04.
- [ ] **M7-T03 Docs & CI polish** (`README.md`, `docs/ui/styleguide.md`, `docs/data/market.md`, `.github/workflows/ci.yml`)
  - **Sub-steps**: (a) Update docs to reflect final features and SDE handling; (b) Add CI workflow covering lint/tests/contracts/perf smoke; (c) Include artifact publishing for contracts.
  - **Notes**: Ensure constitution guardrails called out (FastAPI, Docker, accessibility).
  - **Depends on**: All prior milestones.
- [ ] **M7-T04 Performance validation** (`docs/performance.md`, `scripts/perf_smoke.sh`)
  - **Sub-steps**: (a) Measure ingestion <10 min; (b) UI render TTI ≤2s; (c) Record metrics in docs; (d) Add script for repeatable checks.
  - **Notes**: Use sample SDE and recorded market data for repeatable tests.
  - **Depends on**: M7-T01, M6-T03.

## Definition of Done Checklist
- Latest SDE ingested from manual drop in `data/SDE/_downloads/`, with manifests recorded and archives excluded from Git by `.gitignore`.
- FastAPI endpoints (`/health`, `/search`, `/ships/:id`, `/blueprints/:id`, `/market/:type_id`) return documented contracts with manifest metadata.
- React UI delivers ship/blueprint browsers with accessibility and reduced-motion compliance, including optional 3D viewer and market charts.
- Market adapters enforce rate limits and retention, surfacing Forge data to the UI.
- Docs/CI updated to mirror milestones; change management rules observed per plan and constitution.
