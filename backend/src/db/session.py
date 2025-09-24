from __future__ import annotations

import os
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


def _database_url() -> str:
    return os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres@db:5432/evedb")


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return create_engine(_database_url())
