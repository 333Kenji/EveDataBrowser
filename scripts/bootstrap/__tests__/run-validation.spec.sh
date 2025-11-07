#!/usr/bin/env bats

setup() {
  BOOTSTRAP_DIR="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  REPO_ROOT="$(cd "$BOOTSTRAP_DIR/../.." && pwd)"
  export BOOTSTRAP_DIR
  export REPO_ROOT
  REPORT_JSON="$REPO_ROOT/logs/bootstrap/latest.json"
  export REPORT_JSON
  rm -f "$REPORT_JSON"
  export BOOTSTRAP_VALIDATION_MODE="${BOOTSTRAP_VALIDATION_MODE:-sample}"
}

@test "captures docker compose health summary" {
  run bash "$BOOTSTRAP_DIR/run-validation.sh"
  [ "$status" -eq 0 ]
  [ -f "$REPORT_JSON" ]
  run grep '"containers"' "$REPORT_JSON"
  [ "$status" -eq 0 ]
}
