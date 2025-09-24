from __future__ import annotations

import datetime as dt
from typing import Dict, List

from ingestion.src.market.base import MarketSnapshot, MarketStub


class Adam4EveStub(MarketStub):
    provider = "adam4eve"

    def fetch(self, type_id: int, window_days: int = 7) -> List[MarketSnapshot]:
        now = dt.datetime.now(dt.timezone.utc)
        return [
            MarketSnapshot(
                provider=self.provider,
                type_id=type_id,
                region_id=10000002,
                ts=now - dt.timedelta(days=offset),
                price=50.0 + offset,
                volume=1_000 + offset * 10,
                spread=2.5,
                payload={"stub": True, "day": offset},
            )
            for offset in range(window_days)
        ]
