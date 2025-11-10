#!/usr/bin/env bash
set -euo pipefail

QA_DIR="${1:-logs/ingestion/qa}"
RETENTION_DAYS="${2:-14}"

if [ ! -d "${QA_DIR}" ]; then
  echo "QA directory ${QA_DIR} does not exist; skipping cleanup"
  exit 0
fi

find "${QA_DIR}" -mindepth 1 -maxdepth 1 -mtime +"${RETENTION_DAYS}" -print -delete
echo "Pruned QA reports older than ${RETENTION_DAYS} days from ${QA_DIR}"
