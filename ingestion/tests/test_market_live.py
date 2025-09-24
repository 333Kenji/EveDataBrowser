from __future__ import annotations

import datetime as dt
from typing import List

import httpx
import pytest

from ingestion.src.market.adam4eve import Adam4EveLive, API_URL, REGION_ID
from ingestion.src.market.base import MarketSnapshot


class DummyClient:
    def __init__(self, payload: List[dict]) -> None:
        self.payload = payload
        self.request = None

    def get(self, url: str, params: dict) -> httpx.Response:
        self.request = (url, params)
        request = httpx.Request("GET", url, params=params)
        return httpx.Response(200, json=self.payload, request=request)


def test_adam4eve_live_fetch() -> None:
    now = dt.datetime(2025, 9, 24, tzinfo=dt.timezone.utc)
    payload = [{"date": "2025-09-23", "avgPrice": 50, "avgVolume": 1000}]
    client = DummyClient(payload)
    service = Adam4EveLive(client=client)  # type: ignore[arg-type]

    snapshots = service.fetch(type_id=603, window_days=1)

    assert client.request[0] == API_URL
    assert snapshots[0].provider == "adam4eve"
    assert snapshots[0].region_id == REGION_ID
    assert snapshots[0].price == 50.0


import asyncio
import pytest
from types import SimpleNamespace

import ingestion.src.market.adam4eve as adam_mod


class DummyResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code

    def json(self):
        return self._json

    def raise_for_status(self):
        if not (200 <= self.status_code < 300):
            raise Exception(f"HTTP {self.status_code}")


@pytest.mark.asyncio
async def test_fetch_history_handles_pagination_and_counts(monkeypatch):
    # Prepare two pages of data
    page1 = {"results": [{"date": "2025-01-01", "avg": 100, "volume": 5}], "next": "https://api/next/page2"}
    page2 = {"results": [{"date": "2025-01-02", "avg": 110, "volume": 3}], "next": None}

    calls = {"n": 0}

    async def fake_get(url, timeout):
        calls["n"] += 1
        if "page2" in url:
            return DummyResponse(page2)
        # anything else is first page
        return DummyResponse(page1)

    # Patch AsyncClient.get
    class FakeClient:
        async def get(self, url, timeout=None):
            return await fake_get(url, timeout)

        async def aclose(self):
            return None

    adapter = adam_mod.Adam4EVEAdapter(base_url="https://api.adam4eve.com")
    client = FakeClient()

    results = await adapter.fetch_history(type_id=123, region_id=10000002, client=client)
    # Verify aggregated two points
    assert len(results) == 2
    assert results[0]["date"] == "2025-01-01"
    assert results[1]["date"] == "2025-01-02"
    # call_count should reflect two HTTP calls
    assert adapter.call_count >= 2
