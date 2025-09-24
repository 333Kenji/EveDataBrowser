from __future__ import annotations

from typing import Dict, List

import pytest
from fastapi.testclient import TestClient

from backend.src.api.market import get_market_repository
from backend.src.main import create_app


class StubMarketRepo:
    def __init__(self, series: List[Dict[str, object]]) -> None:
        self.series = series

    def get_market_series(self, provider: str, type_id: int, window_days: int = 7):
        return self.series


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    stub = StubMarketRepo(
        series=[
            {
                "ts": "2025-09-24T00:00:00+00:00",
                "price": 50.0,
                "volume": 1000.0,
                "spread": 2.5,
            }
        ]
    )
    app.dependency_overrides[get_market_repository] = lambda: stub
    return TestClient(app)


def test_market_series_success(client: TestClient) -> None:
    response = client.get("/market/603")
    assert response.status_code == 200
    assert response.headers["X-Provider"] == "adam4eve"
    payload = response.json()
    assert payload["series"][0]["price"] == 50.0


def test_market_series_not_found(client: TestClient) -> None:
    empty_stub = StubMarketRepo(series=[])
    client.app.dependency_overrides[get_market_repository] = lambda: empty_stub
    response = client.get("/market/603")
    assert response.status_code == 404
