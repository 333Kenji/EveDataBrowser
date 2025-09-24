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
  4. Deliver a React + Vite UI with dedicated browsers for Ships and Blueprints.
  5. Make entity card JSON contracts available early so UI can be developed against stable schemas.

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
  - Query params: `q` (string, required), `entity` (`ship|blueprint`, default `ship`), `limit` (default 20, max 100), `offset` (default 0).
  - Behavior: name-prefix + fuzzy search on `invTypes.name` (ships) or blueprint name/product name (blueprints).
  - Response: `{ results: [ { entity: "ship", type_id: 603, name: "Merlin", group: "Frigate" } ], total: 123, limit: 20, offset: 0, manifest_version: "v2024.05.14" }`.

- `GET /ships/{type_id}`
  - Returns Ship Card JSON contract (see Entity Card Contracts).
  - 404 when type or category mismatch.

- `GET /blueprints/{blueprint_type_id}`
  - Returns Blueprint Card JSON contract.

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
  "slots": { "high": 3, "mid": 4, "low": 2, "rig_slots": 2, "rig_size": "Small" },
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
- **Layout**: Left sidebar with entries “Ships” and “Blueprints”. Active item highlights; background uses filament/nodes canvas.
- **Search + Filters**:
  - Shared: search box (name prefix, fuzzy), pagination controls.
  - Ships: filters for race/faction, ship group (Frigate, Cruiser, etc.), future meta level placeholder.
  - Blueprints: filters for product category/group, activity presence (manufacturing/invention/research), future tech level.
- **Result List**: Virtualized list showing name, group, manifest badge.
- **Detail Pane**: Renders JSON contract fields as cards (Ship Card, Blueprint Card). Type IDs displayed but not primary callouts.
- **State Routing**: Query parameters `?entity=ship&q=&page=&filters=` persist state and allow direct linking.
- **Accessibility**: Keyboard navigation across list/detail, reduced-motion toggle disables Background Web animation, color contrast validated to WCAG AA.

## Non-Functional Requirements
- Docker-only development environment with hot reload for backend and frontend via bind mounts.
- Ingestion run < 10 minutes on a workstation when file already available locally.
- API responses < 200 ms for indexed lookups under typical loads (<= 20 concurrent users).
- Log ingestion errors (missing files, checksum mismatch) at `ERROR` level; skip partial updates.
- Provide simple backup/restore guidance for Postgres volume (docker volume snapshot).

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
6. **UI Flows**: Navigate to Ships, search “Merlin”, select first result, verify detail pane renders card and manifest badge; toggle reduced motion disables animation.

## Operational Notes
- Provide quickstart instructions (docker compose up, ingest CLI, open frontend) in README.
- Schedule optional cron-based watcher container once manual ingest stabilises.
- Document pruning strategy for older SDE archives (retain latest N + last major milestone).
