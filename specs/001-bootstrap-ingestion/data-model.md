# Data Model — CCP SDE ingestion bootstrap

## Overview
The feature introduces durable entities for SDE manifests and parsed records that power the Eve Data Browser’s read APIs. The ingestion workflow is responsible for producing and updating these entities, while API services consume them.

## Entities

### SDEManifest
| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key per ingestion run. |
| `version_label` | text | CCP-provided label (e.g., `v2024.05.14`). |
| `source_url` | text | URL used for discovery/download (primary). |
| `mirror_url` | text? | Optional fallback mirror recorded when used. |
| `types_sha256` | text | SHA-256 of decompressed `typeIDs.yaml`. |
| `blueprints_sha256` | text | SHA-256 of decompressed `industryBlueprints.yaml`. |
| `importer_version` | text | Semantic version of ingestion tool. |
| `status` | enum(`queued`,`running`,`succeeded`,`failed`) | Run lifecycle state. |
| `started_at` | timestamptz | UTC start timestamp. |
| `completed_at` | timestamptz? | UTC finish timestamp (null until completion). |
| `error_code` | text? | Machine-readable failure reason. |
| `error_detail` | jsonb? | Extended diagnostic payload. |
| `created_at` | timestamptz | Record creation timestamp. |
| `updated_at` | timestamptz | Record update timestamp. |

**Relationships**: One manifest version corresponds to many `SDEShip` and `SDEBlueprint` records (via `manifest_id`). Only the latest `status='succeeded'` manifest is exposed to clients by default.

### SDEShip
| Field | Type | Notes |
| --- | --- | --- |
| `type_id` | bigint | Primary key (from CCP). |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `name` | text | Localised or fallback English name. |
| `group_id` | bigint | CCP group reference. |
| `category_id` | bigint | CCP category reference. |
| `race_id` | bigint | Race/faction reference. |
| `description` | text | Ship description. |
| `attributes` | jsonb | Aggregated slots, hardpoints, mass, volume, CPU, powergrid, align time. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### SDEBlueprint
| Field | Type | Notes |
| --- | --- | --- |
| `blueprint_type_id` | bigint | Primary key. |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `product_type_id` | bigint | Output item type. |
| `name` | text | Blueprint name. |
| `max_production_limit` | integer | Runs per job. |
| `meta` | jsonb | Additional blueprint metadata (tech level, published). |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### SDEIndustryMaterial
| Field | Type | Notes |
| --- | --- | --- |
| `blueprint_type_id` | bigint | Blueprint reference. |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `activity_id` | smallint | Manufacturing/research/invention. |
| `material_type_id` | bigint | Material type reference. |
| `quantity` | bigint | Required quantity. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### IngestionRunEvent
| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Event id. |
| `manifest_id` | UUID | Associated manifest/run. |
| `stage` | enum(`discover`,`download_types`,`download_blueprints`,`decompress`,`write_json`,`upsert_db`,`complete`,`fail`) | Pipeline stage checkpoints. |
| `message` | text | Human readable description. |
| `context` | jsonb | Extra metadata (duration, retries). |
| `created_at` | timestamptz | Timestamp. |

Used for observability/logging.

## Relationships Overview
```
SDEManifest (1) ──< SDEShip
          └──< SDEBlueprint
          └──< SDEIndustryMaterial
          └──< IngestionRunEvent
```

Only one manifest is “active" for browsing at a time (business rule). Historical manifests retained for audit.

## Ingestion State Machine
```
queued → running → { succeeded | failed }
```
- Transition `running → failed` captures `error_code` and leaves latest successful manifest active.
- Transition `succeeded` updates corresponding manifest FKs; idempotent re-run with identical checksums short-circuits to `succeeded` without modifying dependent tables.

## Indexing & Performance Notes
- Primary indexes on `SDEShip.type_id`, `SDEBlueprint.blueprint_type_id`, `SDEManifest.status`.
- Partial index on `SDEManifest` where `status='succeeded'` for fast lookup of latest record.
- Btree indexes on lower-cased ship and blueprint names for search; optional GIN index on `attributes` for future filtering.

## Access Patterns
- Backend API queries join `SDEShip` and `SDEBlueprint` filtered by `manifest_id = latest_successful_manifest_id()`.
- Health endpoint queries `SDEManifest` for freshness and status.
- Frontend displays manifest metadata from API response headers/payload.

## Data Lifecycle
- New manifest inserted with `status=queued`, transitions as pipeline progresses.
- On success: dependent tables repointed to manifest (UPSERT). On failure: dependent tables untouched; logs allow diagnosis.
- Historical manifests retained indefinitely pending future archival policy.
