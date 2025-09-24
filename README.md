# Eve Data Browser

Initial scaffold with Docker-native development workflow.

## Getting Started

1. Copy `.env.example` to `.env` if you need to override the default service credentials.
2. Download the latest CCP SDE archive and place it inside `data/SDE/_downloads/` (the path is bind-mounted into the containers).
3. Build and launch the stack:

   ```bash
   docker compose -f docker/compose.yml up --build
   ```

   Services:
   - Postgres 15 (`db`)
   - Ingestion worker (idle placeholder)
   - FastAPI backend with live reload at http://localhost:8000
   - React/Vite frontend with hot reload at http://localhost:5173

4. Stop the stack when finished:

   ```bash
   docker compose -f docker/compose.yml down
   ```

## Notes

- All development dependencies install inside containers; no host Python/Node setup required.
- SDE archives are ignored by Git via `.gitignore` to prevent accidental commits.
- Frontend/back-end source directories are bind-mounted, so edits on the host (or within cloud dev environments) refresh immediately in the running containers.
