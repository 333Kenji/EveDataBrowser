from __future__ import annotations

import datetime as dt

import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg

from ingestion.src.market.base import MarketSnapshot, MarketStub
from ingestion.src.scheduler import Limiter, MarketScheduler


class DummyLimiter:
    def __init__(self) -> None:
        self.calls = 0

    def acquire(self, key: str) -> bool:
        self.calls += 1
        return True


class DummyFetcher(MarketStub):
    provider = "adam4eve"

    def fetch(self, type_id: int, window_days: int = 7):
        now = dt.datetime.now(dt.timezone.utc)
        return [
            MarketSnapshot(
                provider=self.provider,
                type_id=type_id,
                region_id=10000002,
                ts=now,
                price=50.0,
                volume=1000.0,
                spread=None,
                payload={"stub": True},
            )
        ]


def test_scheduler_inserts_and_retains(tmp_path):
    engine = sa.create_engine("sqlite:///:memory:")
    metadata = sa.MetaData()
    market_snapshots = sa.Table(
        "market_snapshots",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("provider", sa.Text, nullable=False),
        sa.Column("type_id", sa.Integer, nullable=False),
        sa.Column("region_id", sa.Integer, nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("price", sa.Numeric, nullable=True),
        sa.Column("volume", sa.Numeric, nullable=True),
        sa.Column("spread", sa.Numeric, nullable=True),
        sa.Column("payload_json", sa.JSON, nullable=True),
        sa.Column("ingested_from_sde", sa.Boolean, nullable=False, server_default=sa.text("0")),
    )
    metadata.create_all(engine)

    scheduler = MarketScheduler(
        engine=engine,
        fetchers=[DummyFetcher()],
        limiter=DummyLimiter(),
        retention_days=1,
    )
    inserted = scheduler.run_once(type_ids=[603], window_days=7)
    assert inserted == 1

    with engine.connect() as conn:
        count = conn.execute(sa.select(sa.func.count()).select_from(market_snapshots)).scalar_one()
    assert count == 1
