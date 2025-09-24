from __future__ import annotations

import datetime as dt
import os
import uuid
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from backend.src.db.repository import SQLAlchemySearchRepository

DATABASE_URL = "postgresql+psycopg://postgres:postgres@db:5432/evedb"


@pytest.fixture(scope="module")
def engine() -> sa.Engine:
    os.environ["DATABASE_URL"] = DATABASE_URL
    config = Config(str(Path("backend/alembic.ini")))
    config.set_main_option("sqlalchemy.url", DATABASE_URL)
    engine = sa.create_engine(DATABASE_URL)
    with engine.connect() as conn:
        conn.execute(sa.text("DROP TYPE IF EXISTS manifest_status CASCADE"))
        conn.execute(sa.text("DROP TYPE IF EXISTS ingestion_stage CASCADE"))
    command.upgrade(config, "head")
    yield engine
    with engine.connect() as conn:
        conn.execute(sa.text("DROP SCHEMA public CASCADE"))
        conn.execute(sa.text("CREATE SCHEMA public"))
    engine.dispose()


@pytest.fixture(autouse=True)
def cleanup(engine: sa.Engine) -> None:
    yield
    with engine.connect() as conn:
        conn.execute(sa.text("TRUNCATE market_snapshots RESTART IDENTITY CASCADE"))


def test_market_series_returns_points(engine: sa.Engine) -> None:
    repo = SQLAlchemySearchRepository(engine)
    metadata = sa.MetaData()
    market_snapshots = sa.Table("market_snapshots", metadata, autoload_with=engine)
    with engine.begin() as conn:
        now = dt.datetime.now(dt.timezone.utc)
        conn.execute(
            market_snapshots.insert().values(
                provider="adam4eve",
                type_id=603,
                region_id=10000002,
                ts=now,
                price=50,
                volume=1000,
                spread=2,
                payload_json={"stub": True},
            )
        )
    series = repo.get_market_series("adam4eve", 603, window_days=7)
    assert len(series) == 1
    point = series[0]
    assert point["price"] == 50.0
    assert point["volume"] == 1000.0
