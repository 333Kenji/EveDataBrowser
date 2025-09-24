from __future__ import annotations

from typing import Any, List

import pytest
from fastapi.testclient import TestClient

from backend.src.api.search import SearchRepository, SearchResult, get_search_repository
from backend.src.main import create_app


class StubRepo(SearchRepository):
    def __init__(self, ships: List[SearchResult], blueprints: List[SearchResult]) -> None:
        self._ships = ships
        self._blueprints = blueprints

    def search_ships(self, query: str, limit: int = 25) -> List[SearchItem]:
        return self._ships

    def search_blueprints(self, query: str, limit: int = 25) -> List[SearchItem]:
        return self._blueprints


@pytest.fixture
def client() -> TestClient:
    app = create_app()

    stub = StubRepo(
        ships=[
            SearchResult(id="603", name="Merlin", entity="ship", manifest_version="sde-test"),
        ],
        blueprints=[
            SearchResult(id="1001", name="Merlin Blueprint", entity="blueprint", manifest_version="sde-test"),
        ],
    )
    app.dependency_overrides[get_search_repository] = lambda: stub
    return TestClient(app)


def test_search_defaults_to_ships(client: TestClient) -> None:
    response = client.get("/search?q=merlin")
    assert response.status_code == 200
    payload = response.json()
    assert payload["entity"] == "ships"
    assert payload["items"][0]["name"] == "Merlin"


def test_search_can_return_blueprints(client: TestClient) -> None:
    response = client.get("/search", params={"q": "merlin", "entity": "blueprints"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["entity"] == "blueprints"
    assert payload["items"][0]["entity"] == "blueprint"
    assert response.headers["x-manifest-version"] == "sde-test"
