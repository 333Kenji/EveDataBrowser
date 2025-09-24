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


import asyncio
import json
import os
import shutil
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from ingestion.src import scheduler as sched


def test_prune_snapshots_removes_old_files(tmp_path, monkeypatch):
    # Prepare snapshot dir with one old and one recent file
    snap_dir = tmp_path / "snapshots"
    snap_dir.mkdir()
    old = snap_dir / "snapshot_1_old.json"
    recent = snap_dir / "snapshot_2_recent.json"
    old.write_text(json.dumps({"dummy": 1}))
    recent.write_text(json.dumps({"dummy": 2}))

    # set mtimes: old -> 100 days ago, recent -> now
    old_time = (datetime.utcnow() - timedelta(days=100)).timestamp()
    recent_time = datetime.utcnow().timestamp()
    os.utime(old, (old_time, old_time))
    os.utime(recent, (recent_time, recent_time))

    removed = sched.prune_snapshots(retention_days=90, snapshot_dir=snap_dir)
    # old file removed, recent remains
    assert any("snapshot_1_old.json" in str(p) for p in removed)
    assert (recent.exists()) and (not old.exists())


@pytest.mark.asyncio
async def test_scheduler_invokes_adapter(tmp_path, monkeypatch):
    # Create a fake adapter that records calls
    calls = []

    class FakeAdapter:
        async def fetch_history(self, type_id, region_id):
            calls.append((type_id, region_id))
            # return a small payload
            return [{"date": "2025-01-01", "avg": 123, "volume": 1}]

    # run scheduler_loop for a short period with small interval and stop it
    stop_event = asyncio.Event()

    async def stopper(delay):
        await asyncio.sleep(0.2)
        stop_event.set()

    type_ids = [1001, 1002]
    # run scheduler in parallel with stopper
    task = asyncio.create_task(sched.scheduler_loop(FakeAdapter(), type_ids=type_ids, region_id=20000001, interval_minutes=0, jitter_pct=0.0, stop_event=stop_event))
    await stopper(0.2)
    await task

    # Ensure adapter called at least once for each configured type
    assert any(call[0] == 1001 for call in calls)
    assert any(call[0] == 1002 for call in calls)
