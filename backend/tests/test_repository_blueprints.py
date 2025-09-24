from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from backend.src.db.repository import BlueprintDetail, SQLAlchemySearchRepository

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
    truncate = sa.text(
        "TRUNCATE sde_ships, sde_ship_presets, ship_dogma_values, "
        "sde_blueprints, sde_blueprint_presets, blueprint_skill_requirements, "
        "sde_industry_activities, sde_industry_materials, sde_industry_products, "
        "blueprint_invention, ingestion_run_events, dogma_attribute_definitions, "
        "dogma_units, sde_manifests RESTART IDENTITY CASCADE"
    )
    with engine.connect() as conn:
        conn.execute(truncate)


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


def test_get_blueprint_detail(engine: sa.Engine) -> None:
    repo = SQLAlchemySearchRepository(engine)
    with engine.begin() as conn:
        manifest_id = _insert_manifest(conn, "sde-test-blueprint")
        conn.execute(
            sa.text(
                "INSERT INTO sde_blueprints (blueprint_type_id, manifest_id, product_type_id, name) VALUES (:bp_id, :manifest_id, :product, :name)"
            ),
            {"bp_id": 1001, "manifest_id": manifest_id, "product": 603, "name": "Merlin Blueprint"},
        )
        conn.execute(
            sa.text(
                "INSERT INTO sde_industry_activities (blueprint_type_id, manifest_id, activity_id, time) VALUES (:bp_id, :manifest_id, :activity, :time)"
            ),
            {"bp_id": 1001, "manifest_id": manifest_id, "activity": 1, "time": 1200},
        )
        conn.execute(
            sa.text(
                "INSERT INTO sde_industry_materials (blueprint_type_id, manifest_id, activity_id, material_type_id, quantity) VALUES (:bp_id, :manifest_id, :activity, :mat, :qty)"
            ),
            {"bp_id": 1001, "manifest_id": manifest_id, "activity": 1, "mat": 34, "qty": 100},
        )
        conn.execute(
            sa.text(
                "INSERT INTO sde_industry_products (blueprint_type_id, manifest_id, activity_id, product_type_id, quantity) VALUES (:bp_id, :manifest_id, :activity, :prod, :qty)"
            ),
            {"bp_id": 1001, "manifest_id": manifest_id, "activity": 1, "prod": 603, "qty": 1},
        )
        conn.execute(
            sa.text(
                "INSERT INTO blueprint_skill_requirements (blueprint_type_id, manifest_id, activity_id, skill_type_id, level) VALUES (:bp_id, :manifest_id, :activity, :skill, :level)"
            ),
            {"bp_id": 1001, "manifest_id": manifest_id, "activity": 1, "skill": 3380, "level": 3},
        )
    detail = repo.get_blueprint_detail(1001, manifest_version="sde-test-blueprint")
    assert detail == BlueprintDetail(
        blueprint_type_id=1001,
        name="Merlin Blueprint",
        product_type_id=603,
        manifest_version="sde-test-blueprint",
        activities=[
            {
                "activity_id": 1,
                "time": 1200,
                "materials": [{"material_type_id": 34, "quantity": 100}],
                "products": [{"product_type_id": 603, "quantity": 1}],
                "skills": [{"skill_type_id": 3380, "level": 3}],
            }
        ],
    )
