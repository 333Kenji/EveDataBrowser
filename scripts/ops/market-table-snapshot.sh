#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${SNAPSHOT_OUTPUT_DIR:-logs/ingestion/snapshots}"
TABLES=(
  "public.market_price_history"
  "public.market_latest_stats"
  "public.item_prices_fact"
  "public.market_history_refresh_cache"
)

mkdir -p "${OUTPUT_DIR}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
FILENAME="market-data-snapshot-${TIMESTAMP}.sql"

PGDUMP_OPTS=(
  "--no-owner"
  "--no-privileges"
  "--format=p"
  "--file=${OUTPUT_DIR}/${FILENAME}"
)

for table in "${TABLES[@]}"; do
  PGDUMP_OPTS+=("--table=${table}")
done

printf "Writing market tables snapshot to %s\n" "${OUTPUT_DIR}/${FILENAME}"
pg_dump "${PGDUMP_OPTS[@]}"
printf "Snapshot complete\n"
