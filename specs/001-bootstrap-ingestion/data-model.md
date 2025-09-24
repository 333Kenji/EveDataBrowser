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
| `structures_sha256` | text? | Optional if additional files ingested. |
| `importer_version` | text | Semantic version of ingestion tool. |
| `status` | enum(`queued`,`running`,`succeeded`,`failed`) | Run lifecycle state. |
| `started_at` | timestamptz | UTC start timestamp. |
| `completed_at` | timestamptz? | UTC finish timestamp (null until completion). |
| `error_code` | text? | Machine-readable failure reason. |
| `error_detail` | jsonb? | Extended diagnostic payload. |
| `created_at` | timestamptz | Record creation timestamp. |
| `updated_at` | timestamptz | Record update timestamp. |

**Relationships**: One manifest version corresponds to many `SDEType`, `SDEBlueprint`, and `SDEStructure` records (via `manifest_id`). Only the latest `status='succeeded'` manifest is exposed to clients by default.

### SDEType
| Field | Type | Notes |
| --- | --- | --- |
| `type_id` | bigint | Primary key (from CCP). |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `name` | text | Localised or fallback English name. |
| `group_id` | bigint | CCP group reference. |
| `category_id` | bigint | CCP category reference. |
| `meta` | jsonb | Raw supplemental attributes (mass, volume, flags). |
| `created_at` | timestamptz | Insertion timestamp. |
| `updated_at` | timestamptz | Last update timestamp. |

### SDEBlueprint
| Field | Type | Notes |
| --- | --- | --- |
| `type_id` | bigint | Blueprint type. |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `product_id` | bigint | Output item type. |
| `activity` | enum(`manufacturing`,`reaction`) | Activity scope. |
| `materials` | jsonb | Array of `{ type_id, quantity }`. |
| `output_qty` | integer | Produced quantity for activity. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

Composite primary key: `(type_id, product_id, activity, manifest_id)`.

### SDEStructure
| Field | Type | Notes |
| --- | --- | --- |
| `structure_id` | bigint | Unique identifier. |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `type` | text | Structure classification. |
| `rig_slots` | integer | Slot count. |
| `bonuses` | jsonb | Activity bonuses. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### SDEIndustryMaterial
| Field | Type | Notes |
| --- | --- | --- |
| `type_id` | bigint | Material type reference. |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `source` | text | e.g., `bp_material`. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### SDERig
| Field | Type | Notes |
| --- | --- | --- |
| `rig_id` | bigint | Primary key derived from CCP rig type. |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `name` | text | Localised or fallback English rig name. |
| `activity` | text | Activity classification (Manufacturing, Reactions, Refining, etc.). |
| `me_bonus` | numeric | Material efficiency bonus expressed as decimal. |
| `te_bonus` | numeric | Time efficiency bonus expressed as decimal. |
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
SDEManifest (1) ──< SDEType
          └──< SDEBlueprint
          └──< SDEStructure
          └──< SDEIndustryMaterial
          └──< SDERig
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
- Primary indexes on `SDEType.type_id`, `SDEBlueprint (product_id, activity)`, `SDEManifest.status`.
- Partial index on `SDEManifest` where `status='succeeded'` for fast lookup of latest record.
- Gin indexes on JSONB columns (`meta`, `materials`) for advanced filtering once requirements surface.

## Access Patterns
- Backend API queries join `SDEType` and `SDEBlueprint` filtered by `manifest_id = latest_successful_manifest_id()`.
- Health endpoint queries `SDEManifest` for freshness and status.
- Frontend displays manifest metadata from API response headers/payload.
- Rig-focused UI/API surfaces query `SDERig` for activity bonuses associated with the active manifest.

## Data Lifecycle
- New manifest inserted with `status=queued`, transitions as pipeline progresses.
- On success: dependent tables repointed to manifest (UPSERT). On failure: dependent tables untouched; logs allow diagnosis.
- Historical manifests retained indefinitely pending future archival policy.
