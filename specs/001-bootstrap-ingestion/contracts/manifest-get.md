# Contract — GET /api/manifest

## Purpose
Provide clients with the latest successful SDE manifest metadata for display and monitoring.

## Request
- **Method**: GET
- **Path**: `/api/manifest`
- **Headers**: `Accept: application/json`
- **Auth**: None (read-only public endpoint)

## Successful Response (200)
```json
{
  "version": "v2024.05.14",
  "status": "succeeded",
  "types_sha256": "<sha256>",
  "blueprints_sha256": "<sha256>",
  "structures_sha256": "<sha256 or null>",
  "source_url": "https://developers.eveonline.com/static-data",
  "importer_version": "1.0.0",
  "started_at": "2025-09-21T18:04:05Z",
  "completed_at": "2025-09-21T18:07:11Z",
  "ingestion_latency_seconds": 186,
  "notes": {
    "download_bytes": {
      "type_ids": 1684321234,
      "blueprints": 154332211
    },
    "ingestion_run_id": "9a0e3c2b-..."
  }
}
```

## Error Responses
- **503 Service Unavailable**: Returned when no successful manifest exists. Payload includes `status: "unavailable"` and message.
- **500 Internal Server Error**: Unexpected failures (logged with run ID).

## Side effects
None — read-only.

## Headers
- `Cache-Control: public, max-age=300`
- `ETag`: Manifest checksum (e.g., `W/"v2024.05.14-<sha256>`)

## Validation Rules
- Response MUST include `completed_at` when `status='succeeded'`.
- `status` MUST reflect latest run (`succeeded`, `running`, `failed`); only `succeeded` clients treat as authoritative.
- `ingestion_latency_seconds` computed as `(completed_at - started_at)`; omit when run incomplete.
- On `failed`, include `notes.error_code` and `notes.error_detail`.
