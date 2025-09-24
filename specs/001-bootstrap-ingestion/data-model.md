# Data Model — CCP SDE ingestion bootstrap

## Overview
The feature introduces durable entities for SDE manifests and parsed records that power the Eve Data Browser’s read APIs. The ingestion workflow is responsible for producing and updating these entities, while API services consume them.

Phase-1 deliberately scopes ingestion to high-value YAML payloads (`types`, `typeDogma`, `dogmaAttributes`, `typeMaterials`, `blueprints`, supporting lookups) and skips megafiles (e.g., `mapMoons`, `mapPlanets`, `mapAsteroidBelts`) to keep memory pressure predictable.

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
| `name` | text | English display name (Phase-1 UI) drawn from `name.en`. |
| `name_localized` | jsonb | Optional map of locale → string retained for future localisation. |
| `group_id` | bigint | CCP group reference. |
| `category_id` | bigint | CCP category reference. |
| `race_id` | bigint | Race/faction reference. |
| `faction_id` | bigint? | Nullable faction reference when present. |
| `market_group_id` | bigint? | Market grouping for UI navigation. |
| `description` | text | Ship description. |
| `base_price` | numeric | Base price from SDE for economic context. |
| `meta_group_id` | bigint? | Technology tier.
| `mass` | numeric | Hull mass (kg). |
| `volume` | numeric | Volume (m³). |
| `capacity` | numeric | Cargo hold size. |
| `radius` | numeric | Bounding radius. |
| `portion_size` | integer | Portion size for market handling. |
| `sound_id` | integer? | Audio cue reference. |
| `attributes` | jsonb | Aggregated slots, hardpoints, CPU, powergrid, align time derived from dogma join. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### DogmaAttributeDefinition
| Field | Type | Notes |
| --- | --- | --- |
| `attribute_id` | integer | Primary key from `dogmaAttributes.yaml`. |
| `name` | text | Internal attribute name. |
| `display_name` | jsonb | Localised labels (retain for accessibility). |
| `description` | text? | Attribute description. |
| `unit_id` | integer? | Reference to units table when provided. |
| `high_is_good` | boolean | Guidance for UI theming. |
| `default_value` | numeric? | Used when attribute missing. |
| `stackable` | boolean | Captured for completeness. |
| `metadata` | jsonb | Extra fields (icon, tooltip, category). |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### DogmaUnit
| Field | Type | Notes |
| --- | --- | --- |
| `unit_id` | integer | Primary key from `dogmaUnits.yaml`. |
| `display_name` | jsonb | Localised unit label. |
| `description` | text? | Unit description. |
| `symbol` | text? | Short symbol for UI (e.g., `m³`). |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### ShipDogmaValue
| Field | Type | Notes |
| --- | --- | --- |
| `type_id` | bigint | Ship reference. |
| `attribute_id` | integer | FK → `DogmaAttributeDefinition`. |
| `manifest_id` | UUID | For manifest-specific diffs. |
| `value` | numeric | Attribute magnitude from `typeDogma.yaml`. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### SDEShipPreset
| Field | Type | Notes |
| --- | --- | --- |
| `type_id` | bigint | Ship reference.
| `faction` | text | Faction name derived from race/faction mapping.
| `race` | text | Race label.
| `group` | text | Ship group label (e.g., Frigate).
| `category` | text | Category label.
| `theme_token` | text | Optional token for theming (e.g., `caldari-industrial`).

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

### BlueprintSkillRequirement
| Field | Type | Notes |
| --- | --- | --- |
| `blueprint_type_id` | bigint | Blueprint reference. |
| `manifest_id` | UUID | FK for manifest-specific snapshots. |
| `activity_id` | smallint | Manufacturing / invention / research context. |
| `skill_type_id` | bigint | Required skill. |
| `level` | integer | Required level. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### SDEBlueprintPreset
| Field | Type | Notes |
| --- | --- | --- |
| `blueprint_type_id` | bigint | Blueprint reference. |
| `faction` | text | Faction inferred from product type. |
| `group` | text | Product group label. |
| `category` | text | Product category label. |
| `theme_token` | text | Optional theming token. |

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

### SDEIndustryActivity
| Field | Type | Notes |
| --- | --- | --- |
| `blueprint_type_id` | bigint | Blueprint reference. |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `activity_id` | smallint | CCP industry activity id. |
| `time` | integer | Activity duration in seconds. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### SDEIndustryProduct
| Field | Type | Notes |
| --- | --- | --- |
| `blueprint_type_id` | bigint | Blueprint reference. |
| `manifest_id` | UUID (FK) | Links to `SDEManifest`. |
| `activity_id` | smallint | Activity context for product. |
| `product_type_id` | bigint | Product output type. |
| `quantity` | bigint | Units produced. |
| `probability` | numeric? | Success chance for invention outputs (nullable for deterministic activities). |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### BlueprintInvention
| Field | Type | Notes |
| --- | --- | --- |
| `blueprint_type_id` | bigint | Blueprint reference. |
| `datacores` | jsonb | Array of `{ type_id, name, qty }`.
| `decryptors` | jsonb | Array metadata (optional future use). |
| `base_chance` | numeric | Base invention chance. |
| `created_at` | timestamptz | Timestamp. |
| `updated_at` | timestamptz | Timestamp. |

### MarketSnapshot
| Field | Type | Notes |
| --- | --- | --- |
| `provider` | text | Source identifier (e.g., `adam4eve`). |
| `type_id` | bigint | Ship/blueprint type reference. |
| `region_id` | bigint | Market region (default: configurable). |
| `ts` | timestamptz | Snapshot timestamp. |
| `price` | numeric | Mid price or median day price. |
| `volume` | numeric | Volume traded. |
| `spread` | numeric | Optional spread/variance metric. |
| `payload_json` | jsonb | Raw provider payload for audit. |
| `created_at` | timestamptz | Timestamp. |
| `ingested_from_sde` | boolean | False for live provider data; true when seeded from static `marketGroups.yaml` alignments. |


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
          └──< SDEShipPreset
          └──< SDEBlueprint
          └──< SDEBlueprintPreset
          └──< SDEIndustryActivity
          └──< SDEIndustryMaterial
          └──< SDEIndustryProduct
          └──< BlueprintInvention
          └──< IngestionRunEvent

MarketSnapshot (provider scoped) stored independently keyed by `(provider,type_id,region_id,ts)`.
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
- Btree indexes on lower-cased ship and blueprint names for search; optional GIN index on `SDEShip.attributes` and `SDEIndustryMaterial.material_type_id` for future filtering.

## Access Patterns
- Backend API queries join `SDEShip`, `ShipDogmaValue` + `DogmaAttributeDefinition`, `SDEShipPreset`, `SDEBlueprint`, `BlueprintSkillRequirement`, `SDEBlueprintPreset`, `SDEIndustryActivity`, `SDEIndustryMaterial`, `SDEIndustryProduct`, and `BlueprintInvention` filtered by `manifest_id = latest_successful_manifest_id()`.
- Health endpoint queries `SDEManifest` for freshness and status.
- Frontend displays manifest metadata from API response headers/payload and uses preset tables for theming/filtering.
- Market charts query `MarketSnapshot` for latest 7/30-day windows per provider (Forge only).

## Data Lifecycle
- New manifest inserted with `status=queued`, transitions as pipeline progresses.
- On success: dependent tables repointed to manifest (UPSERT). On failure: dependent tables untouched; logs allow diagnosis.
- Historical manifests retained indefinitely pending future archival policy.
