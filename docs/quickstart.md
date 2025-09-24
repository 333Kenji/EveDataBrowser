# Eve Data Browser Quickstart

## Prerequisites
- Docker + Docker Compose
- CCP SDE archive downloaded manually (e.g., `sde-2024-09-01.zip`)

## Setup Steps
1. Clone the repository.
2. Copy `.env.example` to `.env` if you need to override default credentials.
3. Place the SDE archive inside `data/SDE/_downloads/`. Git ignores this path so archives are never committed.
4. Build and start the stack:
   ```bash
   docker compose -f docker/compose.yml up --build
   ```
   This launches Postgres, the ingestion worker, the FastAPI backend, and the React dev server with hot reload.

## Ingestion Workflow (placeholder)
- Run ingestion once the pipeline is implemented:
  ```bash
  docker compose -f docker/compose.yml run --rm ingestion bash -lc "source /opt/venv/bin/activate && python -m ingestion.src.main"
  ```
- Verify a manifest row was recorded (future work will provide a CLI command / API endpoint).

## Shutdown
```bash
docker compose -f docker/compose.yml down
```

## Notes
- All development happens in containers; no host installations are required.
- Tests and linting run via make targets (`make lint`, `make test`) which delegate to Docker Compose services.
- Additional instructions will be added as the ingestion pipeline and UI are implemented.
