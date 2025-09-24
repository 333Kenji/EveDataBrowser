from __future__ import annotations

import datetime as dt
from typing import Iterable, List, Protocol

import sqlalchemy as sa

from ingestion.src.market.base import MarketSnapshot


class MarketFetcher(Protocol):
    provider: str

    def fetch(self, type_id: int, window_days: int = 7) -> List[MarketSnapshot]:
        ...


class Limiter(Protocol):
    def acquire(self, key: str) -> bool:
        ...


class MarketScheduler:
    def __init__(
        self,
        engine: sa.Engine,
        fetchers: Iterable[MarketFetcher],
        limiter: Limiter,
        retention_days: int = 90,
    ) -> None:
        self.engine = engine
        self.fetchers = list(fetchers)
        self.limiter = limiter
        self.retention_days = retention_days
        metadata = sa.MetaData()
        self.market_snapshots = sa.Table("market_snapshots", metadata, autoload_with=engine)

    def run_once(self, type_ids: Iterable[int], window_days: int = 7) -> int:
        inserted = 0
        with self.engine.begin() as conn:
            for fetcher in self.fetchers:
                if not self.limiter.acquire(fetcher.provider):
                    continue
                for type_id in type_ids:
                    series = fetcher.fetch(type_id=type_id, window_days=window_days)
                    for snapshot in series:
                        conn.execute(
                            sa.dialects.postgresql.insert(self.market_snapshots)
                            .values(
                                provider=snapshot.provider,
                                type_id=snapshot.type_id,
                                region_id=snapshot.region_id,
                                ts=snapshot.ts,
                                price=snapshot.price,
                                volume=snapshot.volume,
                                spread=snapshot.spread,
                                payload_json=snapshot.payload,
                                ingested_from_sde=False,
                            )
                            .on_conflict_do_nothing(
                                index_elements=[
                                    self.market_snapshots.c.provider,
                                    self.market_snapshots.c.type_id,
                                    self.market_snapshots.c.region_id,
                                    self.market_snapshots.c.ts,
                                ]
                            )
                        )
                        inserted += 1
            cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=self.retention_days)
            conn.execute(
                sa.delete(self.market_snapshots).where(self.market_snapshots.c.ts < cutoff)
            )
        return inserted
