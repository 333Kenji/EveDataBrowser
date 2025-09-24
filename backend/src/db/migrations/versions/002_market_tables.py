"""Market snapshots schema"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002_market_tables"
down_revision = "001_bootstrap_sde_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "market_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("type_id", sa.BigInteger(), nullable=False),
        sa.Column("region_id", sa.BigInteger(), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("price", sa.Numeric(), nullable=True),
        sa.Column("volume", sa.Numeric(), nullable=True),
        sa.Column("spread", sa.Numeric(), nullable=True),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ingested_from_sde", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_market_snapshots_provider_type_region_ts",
        "market_snapshots",
        ["provider", "type_id", "region_id", "ts"],
    )
    op.create_index(
        "ix_market_snapshots_type_ts",
        "market_snapshots",
        ["type_id", "ts"],
    )


def downgrade() -> None:
    op.drop_index("ix_market_snapshots_type_ts", table_name="market_snapshots")
    op.drop_constraint("uq_market_snapshots_provider_type_region_ts", "market_snapshots", type_="unique")
    op.drop_table("market_snapshots")
