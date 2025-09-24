from __future__ import annotations

import datetime as dt
import random
from typing import List, Dict, Optional

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


class Adam4EVEAdapter:
    """
    Minimal Adam4EVE adapter:
    - fetch_history: fetches market history for a type_id in a region, handling simple pagination and retry/backoff.
    - call_count: number of HTTP calls made (useful for logging/rate accounting).
    Notes: This is a small, testable adapter intended as a starting point. Replace / extend with real pagination/ETag persistence as needed.
    """

    def __init__(self, base_url: str = "https://api.adam4eve.com", timeout: float = 10.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.call_count = 0

    async def _get_json(self, client: httpx.AsyncClient, url: str, max_retries: int = 3) -> Dict:
        backoff = 0.5
        for attempt in range(1, max_retries + 1):
            try:
                self.call_count += 1
                resp = await client.get(url, timeout=self.timeout)
                resp.raise_for_status()
                return resp.json()
            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                if attempt == max_retries:
                    raise
                # jittered exponential backoff
                jitter = random.uniform(0, 0.2)
                await asyncio.sleep(backoff + jitter)
                backoff *= 2
        # should not reach here
        raise RuntimeError("unreachable retry exit")

    async def fetch_history(
        self,
        type_id: int,
        region_id: int,
        window_days: int = 30,
        client: Optional[httpx.AsyncClient] = None,
    ) -> List[Dict]:
        """
        Fetch market history for type_id in region_id and return list of normalized points.
        Expected external shape: a JSON array of {date, avg, min, max, volume} or paginated objects containing 'results' + 'next'.
        """
        own_client = False
        if client is None:
            client = httpx.AsyncClient()
            own_client = True

        try:
            # Construct initial URL - adapter-friendly shape (may need adjusting to actual API)
            url = f"{self.base_url}/markethistory/{region_id}/{type_id}"
            aggregated = []

            while url:
                payload = await self._get_json(client, url)
                # Support two common shapes:
                # 1) Direct list of points
                # 2) Dict with 'results' list and optional 'next' URL
                if isinstance(payload, list):
                    points = payload
                    next_url = None
                elif isinstance(payload, dict):
                    if "results" in payload and isinstance(payload["results"], list):
                        points = payload["results"]
                        next_url = payload.get("next")
                    else:
                        # Fallback: try to find list payload under 'data' or similar
                        points = payload.get("data") or payload.get("history") or []
                        next_url = payload.get("next")
                else:
                    points = []
                    next_url = None

                # Normalize and append
                for p in points:
                    # best-effort normalization
                    normalized = {
                        "date": p.get("date") or p.get("day") or p.get("timestamp"),
                        "avg": p.get("avg") or p.get("average") or p.get("price_avg"),
                        "min": p.get("min") or p.get("lowest"),
                        "max": p.get("max") or p.get("highest"),
                        "volume": p.get("volume") or p.get("qty") or p.get("trade_volume"),
                        "raw": p,
                    }
                    aggregated.append(normalized)

                # Prepare for next page if present
                url = next_url if next_url else None

            # Optionally trim to window_days - omitted here (depends on API date format)
            return aggregated
        finally:
            if own_client:
                await client.aclose()
