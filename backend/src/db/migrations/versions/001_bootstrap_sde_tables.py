"""Initial SDE schema"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001_bootstrap_sde_tables"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'manifest_status') THEN
                CREATE TYPE manifest_status AS ENUM ('queued','running','succeeded','failed');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ingestion_stage') THEN
                CREATE TYPE ingestion_stage AS ENUM ('discover','download_types','download_blueprints','decompress','write_json','upsert_db','complete','fail');
            END IF;
        END$$;
        """
    )

    manifest_status_enum = postgresql.ENUM(name="manifest_status", create_type=False)
    ingestion_stage_enum = postgresql.ENUM(name="ingestion_stage", create_type=False)

    op.create_table(
        "sde_manifests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("version_label", sa.Text(), nullable=False, unique=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("mirror_url", sa.Text(), nullable=True),
        sa.Column("types_sha256", sa.Text(), nullable=True),
        sa.Column("blueprints_sha256", sa.Text(), nullable=True),
        sa.Column("importer_version", sa.Text(), nullable=True),
        sa.Column("status", manifest_status_enum, nullable=False, server_default="queued"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.Column("error_detail", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_sde_manifests_status",
        "sde_manifests",
        ["status"],
    )
    op.create_index(
        "ix_sde_manifests_latest_success",
        "sde_manifests",
        ["completed_at"],
        unique=False,
        postgresql_where=sa.text("status = 'succeeded'"),
    )

    op.create_table(
        "dogma_units",
        sa.Column("unit_id", sa.Integer(), primary_key=True),
        sa.Column("display_name", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("symbol", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "dogma_attribute_definitions",
        sa.Column("attribute_id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("display_name", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("unit_id", sa.Integer(), sa.ForeignKey("dogma_units.unit_id", ondelete="SET NULL")),
        sa.Column("high_is_good", sa.Boolean(), nullable=True),
        sa.Column("default_value", sa.Numeric(), nullable=True),
        sa.Column("stackable", sa.Boolean(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "sde_ships",
        sa.Column("type_id", sa.BigInteger(), primary_key=True),
        sa.Column("manifest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sde_manifests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("name_localized", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("group_id", sa.BigInteger(), nullable=False),
        sa.Column("category_id", sa.BigInteger(), nullable=False),
        sa.Column("race_id", sa.BigInteger(), nullable=True),
        sa.Column("faction_id", sa.BigInteger(), nullable=True),
        sa.Column("market_group_id", sa.BigInteger(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("base_price", sa.Numeric(), nullable=True),
        sa.Column("meta_group_id", sa.BigInteger(), nullable=True),
        sa.Column("mass", sa.Numeric(), nullable=True),
        sa.Column("volume", sa.Numeric(), nullable=True),
        sa.Column("capacity", sa.Numeric(), nullable=True),
        sa.Column("radius", sa.Numeric(), nullable=True),
        sa.Column("portion_size", sa.Integer(), nullable=True),
        sa.Column("sound_id", sa.Integer(), nullable=True),
        sa.Column("attributes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_sde_ships_manifest", "sde_ships", ["manifest_id"])
    op.create_index("ix_sde_ships_name", "sde_ships", ["name"])

    op.create_table(
        "sde_ship_presets",
        sa.Column("type_id", sa.BigInteger(), sa.ForeignKey("sde_ships.type_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("faction", sa.Text(), nullable=True),
        sa.Column("race", sa.Text(), nullable=True),
        sa.Column("group", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("theme_token", sa.Text(), nullable=True),
    )

    op.create_table(
        "ship_dogma_values",
        sa.Column("type_id", sa.BigInteger(), sa.ForeignKey("sde_ships.type_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("attribute_id", sa.Integer(), sa.ForeignKey("dogma_attribute_definitions.attribute_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("manifest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sde_manifests.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("value", sa.Numeric(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "sde_blueprints",
        sa.Column("blueprint_type_id", sa.BigInteger(), primary_key=True),
        sa.Column("manifest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sde_manifests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_type_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("max_production_limit", sa.Integer(), nullable=True),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_sde_blueprints_manifest", "sde_blueprints", ["manifest_id"])

    op.create_table(
        "sde_blueprint_presets",
        sa.Column("blueprint_type_id", sa.BigInteger(), sa.ForeignKey("sde_blueprints.blueprint_type_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("faction", sa.Text(), nullable=True),
        sa.Column("group", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("theme_token", sa.Text(), nullable=True),
    )

    op.create_table(
        "blueprint_skill_requirements",
        sa.Column("blueprint_type_id", sa.BigInteger(), sa.ForeignKey("sde_blueprints.blueprint_type_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("manifest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sde_manifests.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("activity_id", sa.SmallInteger(), primary_key=True),
        sa.Column("skill_type_id", sa.BigInteger(), primary_key=True),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "sde_industry_activities",
        sa.Column("blueprint_type_id", sa.BigInteger(), sa.ForeignKey("sde_blueprints.blueprint_type_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("manifest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sde_manifests.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("activity_id", sa.SmallInteger(), primary_key=True),
        sa.Column("time", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "sde_industry_materials",
        sa.Column("blueprint_type_id", sa.BigInteger(), sa.ForeignKey("sde_blueprints.blueprint_type_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("manifest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sde_manifests.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("activity_id", sa.SmallInteger(), primary_key=True),
        sa.Column("material_type_id", sa.BigInteger(), primary_key=True),
        sa.Column("quantity", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "sde_industry_products",
        sa.Column("blueprint_type_id", sa.BigInteger(), sa.ForeignKey("sde_blueprints.blueprint_type_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("manifest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sde_manifests.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("activity_id", sa.SmallInteger(), primary_key=True),
        sa.Column("product_type_id", sa.BigInteger(), primary_key=True),
        sa.Column("quantity", sa.BigInteger(), nullable=False),
        sa.Column("probability", sa.Numeric(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "blueprint_invention",
        sa.Column("blueprint_type_id", sa.BigInteger(), sa.ForeignKey("sde_blueprints.blueprint_type_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("manifest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sde_manifests.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("datacores", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("decryptors", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("base_chance", sa.Numeric(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "ingestion_run_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("manifest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sde_manifests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage", ingestion_stage_enum, nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ingestion_run_events_manifest", "ingestion_run_events", ["manifest_id"])


def downgrade() -> None:
    op.drop_index("ix_ingestion_run_events_manifest", table_name="ingestion_run_events")
    op.drop_table("ingestion_run_events")

    op.drop_table("blueprint_invention")
    op.drop_table("sde_industry_products")
    op.drop_table("sde_industry_materials")
    op.drop_table("sde_industry_activities")
    op.drop_table("blueprint_skill_requirements")
    op.drop_table("sde_blueprint_presets")
    op.drop_index("ix_sde_blueprints_manifest", table_name="sde_blueprints")
    op.drop_table("sde_blueprints")

    op.drop_table("ship_dogma_values")
    op.drop_table("sde_ship_presets")
    op.drop_index("ix_sde_ships_name", table_name="sde_ships")
    op.drop_index("ix_sde_ships_manifest", table_name="sde_ships")
    op.drop_table("sde_ships")

    op.drop_table("dogma_attribute_definitions")
    op.drop_table("dogma_units")

    op.drop_index("ix_sde_manifests_latest_success", table_name="sde_manifests")
    op.drop_index("ix_sde_manifests_status", table_name="sde_manifests")
    op.drop_table("sde_manifests")

    op.execute("DROP TYPE IF EXISTS ingestion_stage")
    op.execute("DROP TYPE IF EXISTS manifest_status")
