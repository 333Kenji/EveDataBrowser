from __future__ import annotations

import datetime as dt

from ingestion.src.market.adam4eve_stub import Adam4EveStub
from ingestion.src.market.fuzzwork_stub import FuzzworkStub


def test_adam4eve_stub_generates_window() -> None:
    stub = Adam4EveStub()
    snapshots = stub.fetch(type_id=34, window_days=3)
    assert len(snapshots) == 3
    assert all(s.provider == "adam4eve" for s in snapshots)
    assert snapshots[0].ts > snapshots[-1].ts


def test_fuzzwork_stub_returns_payload() -> None:
    stub = FuzzworkStub()
    snapshots = stub.fetch(type_id=34, window_days=2)
    assert len(snapshots) == 2
    assert snapshots[0].payload["stub"] is True
    assert snapshots[0].payload["window"] == 2
