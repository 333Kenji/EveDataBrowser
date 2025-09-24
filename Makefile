.PHONY: lint lint-backend lint-ingestion lint-frontend test test-backend test-ingestion test-frontend

lint: lint-backend lint-ingestion lint-frontend

lint-backend:
	docker compose -f docker/compose.yml run --rm backend bash -lc "ruff check backend && black --check backend && mypy backend"

lint-ingestion:
	docker compose -f docker/compose.yml run --rm ingestion bash -lc "ruff check ingestion && black --check ingestion && mypy ingestion"

lint-frontend:
	docker compose -f docker/compose.yml run --rm frontend bash -lc "npm run lint"

test: test-backend test-ingestion test-frontend

test-backend:
	docker compose -f docker/compose.yml run --rm backend bash -lc "pytest"

test-ingestion:
	docker compose -f docker/compose.yml run --rm ingestion bash -lc "pytest"

test-frontend:
	docker compose -f docker/compose.yml run --rm frontend bash -lc "npm run test"
