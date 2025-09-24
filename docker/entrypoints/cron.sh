#!/usr/bin/env bash
set -euo pipefail

# Simple cron-style entrypoint to run the ingestion scheduler inside a container.
# Expects Python environment where ingestion package is importable.
# Useful env vars:
#  - ADAM4EVE_ADAPTER_MODULE (e.g., ingestion.src.market.adam4eve:Adam4EVEAdapter)
#  - SCHED_TYPE_IDS (comma-separated type ids)
#  - SCHED_INTERVAL_MINUTES
#  - SCHED_RETENTION_DAYS

echo "Starting ingestion scheduler..."
python -u -c "import ingestion.src.scheduler as s; s.main()"
