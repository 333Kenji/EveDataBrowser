from __future__ import annotations

import datetime as dt
from typing import List

import httpx

from ingestion.src.market.base import MarketSnapshot

API_URL = "https://api.adam4eve.eu/market_history"
REGION_ID = 10000002


class Adam4EveLive:
    provider = "adam4eve"

    def __init__(self, client: httpx.Client | None = None) -> None:
        self.client = client or httpx.Client(timeout=10.0)

    def fetch(self, type_id: int, window_days: int = 7) -> List[MarketSnapshot]:
        end = dt.datetime.now(dt.timezone.utc)
        start = end - dt.timedelta(days=window_days)
        params = {
            "type_id": type_id,
            "region_id": REGION_ID,
            "start": start.date().isoformat(),
            "end": end.date().isoformat(),
        }
        response = self.client.get(API_URL, params=params)
        response.raise_for_status()
        payload = response.json()
        snapshots: List[MarketSnapshot] = []
        for entry in payload:
            snapshots.append(
                MarketSnapshot(
                    provider=self.provider,
                    type_id=type_id,
                    region_id=REGION_ID,
                    ts=dt.datetime.fromisoformat(entry["date"]).replace(tzinfo=dt.timezone.utc),
                    price=float(entry.get("avgPrice", 0.0)),
                    volume=float(entry.get("avgVolume", 0.0)),
                    spread=None,
                    payload=entry,
                )
            )
        return snapshots
