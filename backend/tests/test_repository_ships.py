from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from backend.src.api.search import SearchResult
from backend.src.db.repository import SQLAlchemySearchRepository

DATABASE_URL = "postgresql+psycopg://postgres:postgres@db:5432/evedb"


@pytest.fixture(scope="module")
def engine() -> sa.Engine:
    os.environ["DATABASE_URL"] = DATABASE_URL
    config = Config(str(Path(__file__).resolve().parents[2] / "backend/alembic.ini"))
    config.set_main_option("sqlalchemy.url", DATABASE_URL)
    engine = sa.create_engine(DATABASE_URL)
    with engine.connect() as conn:
        conn.execute(sa.text("DROP TYPE IF EXISTS manifest_status CASCADE"))
        conn.execute(sa.text("DROP TYPE IF EXISTS ingestion_stage CASCADE"))
    command.upgrade(config, "head")
    yield engine
    with engine.connect() as conn:
        conn.execute(sa.text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    engine.dispose()


@pytest.fixture(autouse=True)
def cleanup(engine: sa.Engine) -> None:
    yield
    truncate_sql = (
        "TRUNCATE sde_ships, sde_ship_presets, ship_dogma_values, sde_blueprints, "
        "sde_blueprint_presets, blueprint_skill_requirements, sde_industry_activities, "
        "sde_industry_materials, sde_industry_products, blueprint_invention, "
        "ingestion_run_events, dogma_attribute_definitions, dogma_units, sde_manifests "
        "RESTART IDENTITY CASCADE"
    )
    with engine.connect() as conn:
        try:
            conn.execute(sa.text(truncate_sql))
        except sa.exc.ProgrammingError:
            conn.rollback()


def _insert_manifest(conn: sa.Connection, version: str) -> uuid.UUID:
    manifest_id = uuid.uuid4()
    conn.execute(sa.text("DELETE FROM sde_manifests WHERE version_label = :version"), {"version": version})
    conn.execute(
        sa.text(
            "INSERT INTO sde_manifests (id, version_label, status) VALUES (:id, :version, 'succeeded')"
        ),
        {"id": manifest_id, "version": version},
    )
    return manifest_id


def test_search_ships_returns_results(engine: sa.Engine) -> None:
    repo = SQLAlchemySearchRepository(engine)
    with engine.begin() as conn:
        manifest_id = _insert_manifest(conn, "sde-test-ships")
        conn.execute(sa.text("DELETE FROM sde_ships WHERE type_id = :type_id"), {"type_id": 603})
        conn.execute(
            sa.text(
                "INSERT INTO sde_ships (type_id, manifest_id, name, group_id, category_id) VALUES (:type_id, :manifest_id, :name, 25, 6)"
            ),
            {"type_id": 603, "manifest_id": manifest_id, "name": "Merlin"},
        )
    results = repo.search_ships("merl")
    assert results == [
        SearchResult(id="603", name="Merlin", entity="ship", manifest_version="sde-test-ships")
    ]


def test_search_blueprints_returns_results(engine: sa.Engine) -> None:
    repo = SQLAlchemySearchRepository(engine)
    with engine.begin() as conn:
        manifest_id = _insert_manifest(conn, "sde-test-blueprint")
        conn.execute(sa.text("DELETE FROM sde_blueprints WHERE blueprint_type_id = :bp_id"), {"bp_id": 1001})
        conn.execute(
            sa.text(
                "INSERT INTO sde_blueprints (blueprint_type_id, manifest_id, product_type_id, name) VALUES (:bp_id, :manifest_id, :product, :name)"
            ),
            {"bp_id": 1001, "manifest_id": manifest_id, "product": 603, "name": "Merlin Blueprint"},
        )
    results = repo.search_blueprints("merlin")
    assert results == [
        SearchResult(id="1001", name="Merlin Blueprint", entity="blueprint", manifest_version="sde-test-blueprint")
    ]
