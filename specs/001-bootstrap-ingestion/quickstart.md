# Quickstart — CCP SDE ingestion bootstrap

This guide walks through spinning up the Docker stack, running the initial SDE ingestion, and verifying manifest data is visible in the browser UI.

## Prerequisites
- Docker Engine + Docker Compose plugin installed.
- CCP developer account credentials (for manual verification, no auth required for static data download).
- ~5 GB free disk space for SDE artifacts.

## 1. Configure environment
```bash
cp .env.example .env
# Edit .env to set:
# DATABASE_URL=postgresql+psycopg://eve:eve@db:5432/evedb
# SDE_BASE_URL=https://developers.eveonline.com/static-data
# SDE_MANIFEST_PATH=/app/data/sde/manifest.json
```

## 2. Launch Docker stack
```bash
docker compose up -d db
# Wait for Postgres readiness check
./docker/entrypoints/wait-for-db.sh db:5432

docker compose up -d ingestion backend frontend
```

Services launched:
- `db`: PostgreSQL 15 with named volume `pg-data`.
- `ingestion`: Python worker mounted with `data-sde` volume.
- `backend`: Express API exposing `/api/manifest`, `/api/items`.
- `frontend`: Vite dev server at `http://localhost:5173`.

## 3. Trigger ingestion
```bash
docker compose run --rm ingestion python -m ingestion.cli fetch-and-load \
  --base-url ${SDE_BASE_URL} \
  --manifest-path /app/data/sde/manifest.json
```

Expected output:
- Stage logs (discover, download, decompress, upsert).
- Final line `SDE fetched and loaded (version=vYYYY.MM.DD)`.

## 4. Verify manifest
```bash
curl http://localhost:8080/api/manifest | jq
```
Should show latest manifest with `status: "succeeded"` and SHA-256 values.

## 5. Verify items endpoint
```bash
curl "http://localhost:8080/api/items?page=1&page_size=5" \
  -H "Accept: application/json" \
  -D - | jq '.items[0]'
```
Check response headers `x-sde-manifest-version` and ensure payload includes `manifest_version` field.

## 6. Frontend validation
- Visit `http://localhost:5173`.
- Confirm filament Background Web animation renders.
- Toggle "Reduce Motion" control; animation should pause and UI retains contrast.
- Manifest badge in grid header should display version + completed timestamp.

## 7. Observability smoke checks
```bash
curl http://localhost:8080/health/ready | jq
# Expect manifest freshness timestamp within recent ingestion run.
```
Inspect ingestion logs:
```bash
docker compose logs --tail=100 ingestion | jq -r '.message'
```

## 8. Teardown
```bash
docker compose down
```
Named volumes (`data-sde`, `pg-data`) persist; remove with `docker volume rm` if necessary.
