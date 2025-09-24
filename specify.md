# Eve Data Browser Specification

## Context & Purpose
Eve Data Browser ingests CCP Static Data Export (SDE) archives into Postgres and exposes a React filament UI for browsing ships and blueprints. Phase-1 scope emphasises local ingestion, schema normalization, and search-friendly presentation—no job planning, profitability calculators, or ESI integrations.

## Scope (Phase-1)
- Supported entities: **Ships** and **Blueprints**.
- Data source: SDE ZIP/YAML dropped into `data/SDE/_downloads/` (case-insensitive).
- Delivery goals:
  1. Automate detection, checksum, and manifest tracking for new SDE drops.
  2. Normalize minimal CCP tables into Postgres.
  3. Provide public FastAPI endpoints for search and entity detail.
  4. Deliver a React + Vite UI with dedicated browsers for Ships and Blueprints featuring cinematic ship cards and blueprint market-style analytics.
  5. Restrict market analytics to The Forge (Jita) region while keeping provider adapters pluggable.
  6. Make entity card JSON contracts available early so UI can be developed against stable schemas.

## Non-goals
- No manufacturing planning, profitability, or market calculations.
- No ESI pulls or live game state synchronization.
- No authentication, multi-tenant permissions, or write APIs.

## Architecture Overview
```
SDE ZIP → ingestion watcher/CLI (Python) → Postgres (schemas) → FastAPI → React/Vite front end
```
- **Docker-first**: Dev and CI use `docker compose` to orchestrate Postgres, ingestion worker container, FastAPI backend, and Vite frontend.
- **Shared volume**: Named volume `data-sde` mounted across ingestion + backend for raw files, manifests, and JSON derivatives.
- **Observability**: Structured JSON logs, `/health` readiness, metrics for ingestion counts/durations.

## Ingestion Workflow
1. **Detection**
   - Monitor `data/SDE/_downloads/` for archives (`*.zip`, `*.bz2`, decompressed YAML/JSON).
   - Select newest ingestable artifact using semantic version (if present) or mtime fallback. If CCP static data index changes, attempt configured fallback base URL; if still unresolved, surface actionable warning and wait for manual file delivery.
   - Compute SHA-256 for decompressed YAMLs; skip import if `{version, checksum}` already stored in Postgres (`sde_versions`).
2. **Extraction & Normalization**
   - Expand archives to temporary workspace.
   - Parse YAML (or JSON fallback) to in-memory structures with deterministic iteration order.
   - Derive JSON derivatives for quick debugging: `type_ids.json`, `blueprints.json`, `attributes.json`.
3. **Upsert**
   - Within transactions:
     - Upsert into CCP tables (see Schema section) filtered to the minimal fields needed for ships and blueprints.
     - Populate derived views (e.g., slot layout, attribute aggregation) for UI.
     - Generate preset reference tables (faction, race, group, category) for ships/blueprints to drive theming and filtering.
   - Record manifest row in `sde_versions` with `version`, `checksum`, `imported_at`, `source_path`.
4. **Idempotence & Cleanup**
   - If a checksum mismatch occurs for an existing version, abort and log error (no destructive writes).
   - Retain previous manifests and raw archives; mark superseded ones for pruning based on tasks roadmap.

### CLI
`python ingestion/ingest_sde.py --input data/SDE/_downloads/latest.zip` executes a one-shot ingest. Additional watcher process can poll for new drops at configurable intervals.

### Logging
- Capture counts of inserted/updated rows per table.
- Emit warnings for missing optional fields, unknown categories, or partial YAML fragments.
- Summaries post-import: `version`, `checksum`, `elapsed_ms`, `skipped` flag.

## Database Schema (minimal Phase-1)
Tables (example columns only; include timestamps `created_at`, `updated_at` as needed):

| Table | Key Fields | Notes |
|-------|------------|-------|
| `sde_versions` | `version` (PK), `checksum`, `imported_at`, `source_path` | Tracks manifest history + idempotence.
| `invCategories` | `category_id` PK, `name`, `published` | Filter for ships/blueprints categories.
| `invGroups` | `group_id` PK, `category_id` FK, `name`, `published` | supports ship filters.
| `invTypes` | `type_id` PK, `group_id`, `market_group_id`, `name`, `description`, `race_id`, `mass`, `volume`, `capacity`, `published` | Base ship data.
| `typeAttributes` | `type_id`, `attribute_id`, `value` | Derived attribute view for hull stats, slots, CPU/PG, align time.
| `invBlueprintTypes` | `blueprint_type_id` PK, `product_type_id`, `blueprint_type_name`, `max_production_limit` | Base blueprint data.
| `industryActivity` | `blueprint_type_id`, `activity_id`, `time` | Activity durations (manufacturing, invention, research).
| `industryActivityMaterials` | `blueprint_type_id`, `activity_id`, `material_type_id`, `quantity` | Material requirements.
| `industryActivityProducts` | `blueprint_type_id`, `activity_id`, `product_type_id`, `quantity` | Activity outputs.
| `ship_presets` | `type_id`, `faction`, `race`, `group`, `category`, `theme_token` | Derived theming/filter metadata for ships.
| `blueprint_presets` | `blueprint_type_id`, `faction`, `group`, `category`, `theme_token` | Preset metadata for blueprints/products.
| `blueprint_invention` | `blueprint_type_id`, `datacores`, `decryptors`, `base_chance`, timestamps | Invention specifics stored separately.
| `market_snapshots` | `provider`, `type_id`, `region_id`, `ts`, `price`, `volume`, `spread`, `payload_json` | Forge market history with retention policy.
| `typeNames` (optional) | `type_id`, `language`, `name` | For future localization.

Indexes:
- `invTypes` ON (`lower(name)`), `type_id`.
- `invBlueprintTypes` ON (`lower(blueprint_type_name)`), `blueprint_type_id`.
- `industryActivityProducts` ON (`product_type_id`).
- Partial indexes for published ships only.

## API Specification (FastAPI)
- `GET /health`
  - Returns `{status: "ok", version: <manifest_version>, imported_at: <iso>}` when ready.

- `GET /search`
  - Query params: `q` (string, required), `limit` (default 20, max 100), `offset` (default 0).
  - Behavior: name-prefix + fuzzy search across ships (invTypes) and blueprints (invBlueprintTypes/product name) with preset metadata (faction, race, group) applied.
  - Response: `{ ships: [{ type_id, name, group, faction, race }], blueprints: [{ blueprint_type_id, name, product_type_id, product_name }], limit, offset, manifest_version }`.

- `GET /ships/{type_id}`
  - Returns Ship Card JSON contract (see Entity Card Contracts). 404 when not a published ship.

- `GET /blueprints/{blueprint_type_id}`
  - Returns Blueprint Card JSON contract. Includes activities flags even when materials absent.

- `GET /market/{type_id}`
  - Query params: `provider` (`adam4eve` default, `fuzzwork` optional when enabled), `window` (`7d` default, `30d` optional). Market data is restricted to The Forge (Jita) region and handled server-side.
  - Response: `{ provider, region: "The Forge", window, series: [{ ts, price, volume, spread }], meta: { latest_snapshot_at } }`.
  - MVP may return mock data until live provider enabled.

### Common API Rules
- Pagination: defaults `limit=20`, `offset=0`; `limit` capped at 100.
- Sorting: alphabetical by `name` unless filtered.
- Headers: `x-sde-manifest-version`, `x-sde-manifest-imported-at` on all endpoints except `/health` (which embeds values in body).
- Error responses: JSON `{error: <code>, message: <summary>}`.

## Entity Card JSON Contracts
These contracts must be published before endpoint implementation so the React UI can stub against stable schemas.

### Ship Card
```json
{
  "type_id": 603,
  "name": "Merlin",
  "group": { "id": 25, "name": "Frigate" },
  "faction": "Caldari State",
  "race": "Caldari",
  "description": "Long-range frigate ...",
  "slots": { "high": 3, "med": 4, "low": 2, "rig_slots": 2, "rig_size": "Small" },
  "hardpoints": { "turret": 3, "launcher": 2 },
  "attributes": {
    "mass": 1100000,
    "volume": 15000,
    "capacity": 135,
    "align_time": 3.2,
    "cpu": 170,
    "powergrid": 45
  },
  "meta": {
    "hull": "Frigate",
    "published": true,
    "race_id": 2
  },
  "manifest": {
    "version": "v2024.05.14",
    "imported_at": "2025-09-20T18:07:11Z"
  }
}
```

### Blueprint Card
```json
{
  "blueprint_type_id": 987654,
  "name": "Merlin Blueprint",
  "product": {
    "type_id": 603,
    "name": "Merlin",
    "group": "Frigate"
  },
  "activities": [
    {
      "activity": "manufacturing",
      "time": 1200,
      "materials": [
        { "type_id": 34, "name": "Tritanium", "quantity": 132000 },
        { "type_id": 35, "name": "Pyerite", "quantity": 33000 }
      ],
      "products": [
        { "type_id": 603, "name": "Merlin", "quantity": 1 }
      ]
    }
  ],
  "activities_present": {
    "manufacturing": true,
    "research_me": true,
    "research_te": true,
    "invention": false
  },
  "invention": null,
  "max_production_limit": 30,
  "meta": {
    "tech_level": 1,
    "published": true
  },
  "manifest": {
    "version": "v2024.05.14",
    "imported_at": "2025-09-20T18:07:11Z"
  }
}
```

## Frontend Experience (React + Vite)
- **Layout**: Left sidebar with entries “Ships” and “Blueprints”. Active item highlights; background uses filament/nodes canvas. Detail area uses multi-pane layout (primary 3D viewport + data panels).
- **Search + Filters**:
  - Shared: search box (name prefix, fuzzy), pagination controls.
  - Ships: filters for race/faction, ship group (Frigate, Cruiser, etc.), future meta level placeholder.
  - Blueprints: filters for product category/group, activity presence (manufacturing/invention/research), future tech level.
- **Result List**: Virtualized list showing name, group, manifest badge.
- **Ship Detail Card**:
  - 3D viewer pane renders ship model (glTF/Three.js) with faction-themed lighting/background; support rotation, zoom, and screenshot capture.
  - Adjacent info panes list ship summary, bonuses, role bonuses, slot layout, hardpoints, defensive/engineering stats. Content mirrors in-game “Show Info” tone (icons + descriptive text).
  - Tabs/pills for “Characteristics”, “Fittings”, “Lore”; cards pull data from Ship Card JSON contract.
- **Blueprint Detail Card**:
  - Layout follows in-game industry window: inputs on left, process visualization center, outputs/right summary.
  - Include interactive “market” panel using dummy data initially: multi-line price/volume chart with hover highlight for selected material/product trend (imitate EVE market browser).
  - Display Bill of Materials with hover highlighting corresponding line on the chart (glow effect) and quick stats (quantity, dummy price).
- **State Routing**: Query parameters `?entity=ship&q=&page=&filters=` persist state and allow direct linking; deep links to specific ship/blueprint open detail view with proper pane active.
- **Accessibility**: Keyboard navigation across list/detail, reduced-motion toggle disables Background Web animation (falls back to static faction gradient); color contrast validated to WCAG AA; provide textual equivalents for 3D viewer (announce controls, alt text for screenshot).

## Non-Functional Requirements
- Docker-only development environment with hot reload for backend and frontend via bind mounts.
- Ingestion run < 10 minutes on a workstation when file already available locally.
- API responses < 200 ms for indexed lookups under typical loads (<= 20 concurrent users).
- Log ingestion errors (missing files, checksum mismatch) at `ERROR` level; skip partial updates.
- Provide simple backup/restore guidance for Postgres volume (docker volume snapshot).
- 3D assets loaded via optimized glTF models with lazy-loading and fallback placeholder if asset missing; average initial ship card render < 2 seconds on target hardware.
- Blueprint chart interactions maintain 60fps target using canvas/WebGL with dummy data until real metrics integrated.
- Market data snapshot jobs maintain polite cadence under provider rate limits; retention configurable (default 3 months).

## Market Data Management
- Market data limited to The Forge (Jita) region for both providers.
- Providers: Adam4EVE (Phase-1 live) and Fuzzwork (preview). Shared `RateLimiter` (token-bucket + jittered backoff) guarantees compliance with public limits (verify endpoints/limits via provider docs).
- Snapshots: store in `market_snapshots(provider, type_id, region_id, ts, price, volume, spread, payload_json)` with indexes on `(provider, type_id, region_id, ts)` and `(type_id, ts)`.
- Incremental updates: adapters fetch entries newer than the latest stored timestamp per `(provider,type_id,region_id)`; cadence configurable (default 30 minutes) with jitter to avoid thundering herd.
- Retention: configurable (default 3 months) background job prunes older rows.
- API: `/market/{type_id}?provider=adam4eve&window=7d|30d` returns Forge-only price/volume series for UI chart (initially mock data until live adapter flips on).
- Testing: adapter fixtures cover pagination, rate limiting, incremental windows; API contract tests ensure response shape + pagination metadata.

## Presets & Invention Strategy
- Presets (faction, race, group, category) are derived from the SDE during import and persisted to reference tables for UI theming and filter defaults.
- Blueprint invention data is stored in a dedicated `blueprint_invention` table linked via `blueprint_type_id` (approach **b**). API responses aggregate invention details (datacores, decryptors, base chance) inline for client convenience.

## Testing & Quality
- Backend unit tests for ingestion mappers, manifest logic, and FastAPI routers.
- Contract tests verifying `/search`, `/ships/{id}`, `/blueprints/{id}` response shapes.
- Frontend component tests (Vitest + Testing Library) for Ship/Blueprint cards, filters, and state handling.
- Accessibility audits (axe, keyboard traversal) for main browsers.
- Performance smoke test to ensure search pagination remains under 300 ms median.

## Acceptance Tests (Sample)
1. **Ingestion**: Place new `sde-2024-05-14.zip` in `data/SDE/_downloads/`; run CLI. Expect manifest row with checksum, >0 ships + blueprints inserted, logs summarizing counts.
2. **Idempotence**: Re-run CLI with same file. Expect “skipped (checksum unchanged)” log, no new rows, `sde_versions` unchanged except heartbeat timestamp.
3. **Search**: `GET /search?q=Merlin&entity=ship`. Response includes Merlin, manifest headers present, limit/offset defaults respected.
4. **Ship Card**: `GET /ships/603`. Payload matches Ship Card contract; contains slot and attribute fields, manifest metadata.
5. **Blueprint Card**: `GET /blueprints/987654`. Payload matches Blueprint Card contract, with manufacturing materials/time populated.
6. **Ship Viewer**: From Ship browser select “Merlin”; 3D viewer loads faction-themed model, multi-pane layout shows characteristics, slots, lore; reduced-motion toggle swaps to static background.
7. **Blueprint Viewer**: Open “Merlin Blueprint”; bill of materials list mirrors industry UI, hovering material highlights corresponding line on dummy market chart; chart renders multi-series price/volume data.
8. **Market Live Data**: Enable Adam4EVE adapter; `/market/603?window=7d` responds with Forge data and chart updates within UI respecting rate limits.

## Operational Notes
- Provide quickstart instructions (docker compose up, ingest CLI, open frontend) in README.
- Schedule optional cron-based watcher container once manual ingest stabilises.
- Document pruning strategy for older SDE archives (retain latest N + last major milestone).

## Change Management
- Any change to this specification or to `plan.md` REQUIRES refreshing the task backlog.
- Run `/tasks` (or manually extend `tasks.md` and feature-level task files) so every new requirement has explicit coverage before implementation work starts.
- Reviewers must confirm updated specs are linked to concrete tasks and reject changes that leave uncovered scope.
