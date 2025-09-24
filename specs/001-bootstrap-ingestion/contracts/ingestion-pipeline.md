# Contract — SDE ingestion pipeline

## Purpose
Describe the expected behaviour of the end-to-end ingestion job that downloads, validates, and persists CCP SDE artifacts.

## Actors
- **Maintainer / Scheduler**: Triggers ingestion via CLI or scheduled job.
- **Ingestion Worker**: Python service executing the pipeline.
- **Postgres**: Persistent datastore receiving parsed data.

## Pre-conditions
- `DATABASE_URL` and `SDE_BASE_URL` environment variables configured.
- Shared volume `data/sde/` mounted with write access.
- Network access to CCP static data page (or configured mirror).

## Flow
1. **Discover assets**
   - Worker performs HTTP GET to `SDE_BASE_URL` (default `https://developers.eveonline.com/static-data`).
   - Response must include links to `typeIDs.yaml(.bz2)` and `industryBlueprints.yaml(.bz2)`. Missing links → pipeline fails with `error_code=missing_assets`.
2. **Download**
   - Worker downloads each asset with support for resume (`Range` header) and retry/backoff (max 5 attempts exponential).
   - Files stored under `data/sde/_downloads/{filename}`.
   - Worker records HTTP status, byte counts, and final URLs in run log entries.
3. **Decompress**
   - `.bz2` archives decompressed to YAML files with same basename in `_downloads/`.
   - SHA-256 digests computed over decompressed YAML.
4. **Manifest creation**
   - Manifest record created/updated with version label (derived from page or `--version` override), SHA-256 values, timestamps, importer version.
   - If the computed SHA-256 values match the latest successful manifest, pipeline short-circuits with status `succeeded` and note “no changes”.
5. **JSON derivatives**
   - Worker parses YAML to generate JSON artifacts: `type_ids.json`, `blueprints.json`, `attributes.json` saved in `data/sde/` root.
6. **Database upsert**
   - Parsed entities inserted/updated in Postgres tables `invTypes` (ships only), `invBlueprintTypes`, `industryActivity`, `industryActivityMaterials`, `industryActivityProducts`, and `sde_versions` scoped by manifest id.
   - Upserts are transactional per entity type; failure rolls back and sets run status `failed`.
7. **Completion**
   - Run status becomes `succeeded`; manifest `completed_at` set; log entry emitted with summary stats (durations, new records).

## Post-conditions
- Manifest record in `status='succeeded'` with latest version information.
- JSON derivatives and raw downloads available on shared volume.
- API-ready Postgres rows referencing manifest id.
- On failure, prior manifest remains active and pipeline surfaces diagnostic fields (`error_code`, `error_detail`).

## Non-functional guarantees
- Maximum ingestion duration target: < 10 minutes on developer hardware.
- Idempotency: repeating pipeline with identical assets results in no Postgres mutations beyond manifest heartbeat.
- Logging: Each stage emits JSON log entries with `stage`, `manifest_id`, `elapsed_ms`.
