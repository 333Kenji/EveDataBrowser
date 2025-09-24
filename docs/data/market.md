# Market Data Plan — Eve Data Browser

## Providers & Scope
- **Region**: All market analytics restricted to The Forge (Jita) region.
- **Adam4EVE**: Phase-1 live provider (REST endpoints for price history). Respect documented rate limits (default 30 requests/minute); configure per environment.
- **Fuzzwork**: Planned provider; adapter skeleton prepared but disabled until cadence verified.

## Rate Limiting
- Shared `RateLimiter` (token-bucket + jittered backoff) injected into provider adapters.
- Each request must acquire a token; on limit hit, retry with exponential jitter respecting provider guidance.

## Snapshots & Storage
- Table `market_snapshots(provider, type_id, region_id, ts, price, volume, spread, payload_json)`.
- Indexes: `(provider, type_id, region_id, ts)` (unique), `(type_id, ts)` for chart queries.
- Retain last N months (configurable; default 3). `prune_market_snapshots` job removes older rows nightly.

## Incremental Updates
- For each `(provider, type_id, region_id)`, fetch records strictly newer than latest `ts` stored.
- Schedule cadence via async task (default every 30 minutes + jitter). Support manual backfill command.

## API Surface
- `GET /market/{type_id}?provider=adam4eve&window=7d|30d`
  - Returns time series `{ provider, window, series: [{ ts, price, volume, spread }], meta: { latest_snapshot_at } }`.
  - MVP may serve mock data until live adapter enabled.

## Testing
- Provider adapters covered by fixtures (normal + rate-limit scenarios).
- Snapshot pruning, pagination, and `/market` response shape validated via unit/contract tests.

## Open Items
- Confirm final endpoint URLs / query params for Adam4EVE & Fuzzwork (document any changes here).
- Determine retention window configuration (default 3 months) and adjust scheduler.
