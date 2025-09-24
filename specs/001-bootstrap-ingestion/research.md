# Research Log — CCP SDE ingestion bootstrap

## Summary
Establish authoritative references and design constraints for downloading, validating, and serving CCP Static Data Export (SDE) content inside the containerised Eve Data Browser stack.

## Findings

### 1. Authoritative SDE source & mirrors
- **Decision**: Use `https://developers.eveonline.com/static-data` as the primary discovery page; allow configurable mirror override via `SDE_BASE_URL`.
- **Rationale**: CCP’s static data index consistently exposes `typeIDs.yaml.bz2` and `industryBlueprints.yaml.bz2` links and version labels (e.g., `v2024.05.14`). Mirrors occasionally receive updates later, so expose fallback while defaulting to first-party.
- **Alternatives considered**: Direct GitHub mirrors (Fuzzwork) – rejected for production ingest due to unofficial provenance.

- **Decision**: Persist the following assets per run: raw downloads (`_downloads/`), decompressed YAML, JSON derivatives (`type_ids.json`, `blueprints.json`, `attributes.json`), and manifest metadata.
- **Rationale**: Mirrors EVEIndy practice; JSON derivatives accelerate API queries while raw files aid diffing. Expected decompressed size: ~1.6 GB for `typeIDs.yaml`, ~150 MB for blueprints.
- **Alternatives considered**: Dropping raw YAML post-processing – rejected because replays/diffs become impossible without re-downloading.

### 3. Checksum & manifest schema
- **Decision**: Capture SHA-256 for each decompressed YAML, version label, source URL, download timestamp, status, and importer version.
- **Rationale**: SHA-256 matches EVEIndy helper; storing both raw and computed fields supports tamper detection and re-run skip logic.
- **Alternatives considered**: MD5 (faster) – rejected due to weaker collision resistance.

### 4. Docker shared volume strategy
- **Decision**: Mount `data/sde/` as a named volume (`data-sde`) shared across ingestion, backend, and frontend containers (read-only for frontend).
- **Rationale**: Keeps manifests consistent and allows hot reload of assets without container rebuild; matches tasks template expectations.
- **Alternatives considered**: Bind-mount local path – rejected for team parity (differs per developer OS).

### 5. Retry/backoff & timeout policy
- **Decision**: Adopt `tenacity.wait_random_exponential(min=1, max=10)` with up to 5 attempts, 30 s HTTP timeout, resume support via `Range` header.
- **Rationale**: Direct lift from EVEIndy script; balances resilience with operator feedback.
- **Alternatives considered**: Fixed interval retries – rejected for slower recovery when CCP endpoints hiccup.

### 6. Accessibility & animation controls
- **Decision**: Respect `prefers-reduced-motion` and provide explicit UI toggle to disable Background Web animation; degrade gracefully to static gradient.
- **Rationale**: Maintains parity with EVEIndy visual language while meeting WCAG guidance and constitution principle III.
- **Alternatives considered**: Always-on animation – rejected due to accessibility violations.

### 7. Observability & health probes
- **Decision**: Emit JSON logs with ingestion run IDs, manifest version, success/failure. Expose `/health/ready` endpoints including manifest freshness timestamp.
- **Rationale**: Enables monitors to warn when SDE stale; aligns with tasks plan for metrics dashboard stub.
- **Alternatives considered**: Health checks without manifest awareness – rejected because stale data would go unnoticed.

## Open questions / follow-ups
- **Nightly cadence trigger**: Decide between Cron in ingestion container versus external scheduler. *Pending product decision.*
- **Redis usage**: Placeholder in `.env.example`; confirm if we need a cache for long-running queries before provisioning service.

## References
- CCP Static Data: https://developers.eveonline.com/static-data
- EVEIndy ingestion helper: `utils/fetch_and_load_sde.py`
- WCAG reduced motion guidelines: https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html
- Docker named volumes best practice: https://docs.docker.com/storage/volumes/
