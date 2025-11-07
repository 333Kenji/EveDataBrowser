#!/usr/bin/env bash
set -euo pipefail

BOOTSTRAP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$BOOTSTRAP_DIR/../.." && pwd)"
LOG_DIR="$REPO_ROOT/logs/bootstrap"
ARCHIVE_DIR="$LOG_DIR/archive"
REPORT_JSON="${VALIDATION_JSON:-$LOG_DIR/latest.json}"
REPORT_MD="${VALIDATION_MARKDOWN:-$LOG_DIR/latest.md}"
NODE_RUNNER="$BOOTSTRAP_DIR/run-validation.mjs"
RENDERER="$BOOTSTRAP_DIR/render-validation-summary.mjs"
MAX_RUNTIME_MS="${VALIDATION_MAX_RUNTIME_MS:-45000}"

mkdir -p "$ARCHIVE_DIR"

rotate_file() {
  local target="$1"
  if [[ -f "$target" ]]; then
    local base
    base="$(basename "$target")"
    local stamp
    stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
    mv "$target" "$ARCHIVE_DIR/${stamp}-${base}"
  fi
}

rotate_file "$REPORT_JSON"
rotate_file "$REPORT_MD"

START_MS="$(node -e 'process.stdout.write(String(Date.now()))')"

set +e
node "$NODE_RUNNER" --output "$REPORT_JSON"
NODE_STATUS=$?
set -e

if [[ $NODE_STATUS -ne 0 ]]; then
  echo "Bootstrap validation detected issues during data collection" >&2
fi

END_MS="$(node -e 'process.stdout.write(String(Date.now()))')"
DURATION_MS=$((END_MS - START_MS))

node -e "const fs = require('fs'); const file = process.argv[1]; const duration = Number(process.argv[2] || 0); const data = JSON.parse(fs.readFileSync(file, 'utf8')); data.duration_ms = duration; fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');" "$REPORT_JSON" "$DURATION_MS"

node "$RENDERER" --input "$REPORT_JSON" --output "$REPORT_MD"

EXIT_STATUS=$NODE_STATUS

if (( DURATION_MS > MAX_RUNTIME_MS )); then
  node -e "const fs = require('fs'); const file = process.argv[1]; const duration = Number(process.argv[2] || 0); const data = JSON.parse(fs.readFileSync(file, 'utf8')); const message = \
'Validation exceeded runtime budget (observed ' + duration + ' ms)'; if (!Array.isArray(data.remediation_actions)) { data.remediation_actions = []; } if (!data.remediation_actions.includes(message)) { data.remediation_actions.push(message); } data.summary = 'Bootstrap validation exceeded runtime budget (45s).'; data.ok = false; fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');" "$REPORT_JSON" "$DURATION_MS"
  EXIT_STATUS=1
  echo "Bootstrap validation exceeded runtime budget ($DURATION_MS ms > ${MAX_RUNTIME_MS} ms)" >&2
fi

echo "Validation report written to $REPORT_JSON"
echo "Validation summary written to $REPORT_MD"

exit $EXIT_STATUS
