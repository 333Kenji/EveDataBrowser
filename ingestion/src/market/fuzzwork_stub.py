from __future__ import annotations

import datetime as dt
from typing import List

from ingestion.src.market.base import MarketSnapshot, MarketStub


class FuzzworkStub(MarketStub):
    provider = "fuzzwork"

    def fetch(self, type_id: int, window_days: int = 7) -> List[MarketSnapshot]:
        now = dt.datetime.now(dt.timezone.utc)
        return [
            MarketSnapshot(
                provider=self.provider,
                type_id=type_id,
                region_id=10000002,
                ts=now - dt.timedelta(hours=offset * 6),
                price=None,
                volume=500 + offset * 5,
                spread=None,
                payload={"stub": True, "window": window_days},
            )
            for offset in range(window_days)
        ]
