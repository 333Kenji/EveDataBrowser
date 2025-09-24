from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Dict, List, Protocol


@dataclass(frozen=True)
class MarketSnapshot:
    provider: str
    type_id: int
    region_id: int
    ts: dt.datetime
    price: float | None
    volume: float | None
    spread: float | None
    payload: Dict[str, object]


class MarketStub(Protocol):
    provider: str

    def fetch(self, type_id: int, window_days: int = 7) -> List[MarketSnapshot]:
        ...
