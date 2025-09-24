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
