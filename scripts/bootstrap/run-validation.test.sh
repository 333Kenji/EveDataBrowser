#!/usr/bin/env bash
set -euo pipefail

BOOTSTRAP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$BOOTSTRAP_DIR/../.." && pwd)"
VALIDATION_SCRIPT="$BOOTSTRAP_DIR/run-validation.sh"
REPORT_JSON="${VALIDATION_JSON:-$REPO_ROOT/logs/bootstrap/latest.json}"

rm -f "$REPORT_JSON"

export BOOTSTRAP_VALIDATION_MODE="${BOOTSTRAP_VALIDATION_MODE:-sample}"

if ! bash "$VALIDATION_SCRIPT"; then
  echo "run-validation.sh exited with failure status" >&2
  exit 1
fi

if [[ ! -f "$REPORT_JSON" ]]; then
  echo "Expected validation report at $REPORT_JSON" >&2
  exit 1
fi

echo "Validation report created at $REPORT_JSON"
