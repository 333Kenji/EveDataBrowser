from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

import sqlalchemy as sa
from sqlalchemy.engine import Engine

from backend.src.api.search import SearchRepository, SearchResult


@dataclass(frozen=True)
class BlueprintDetail:
    blueprint_type_id: int
    name: str
    product_type_id: int
    manifest_version: str
    activities: List[Dict[str, object]]


@dataclass(frozen=True)
class MarketPoint:
    ts: sa.DateTime
    price: float | None
    volume: float | None
    spread: float | None


class SQLAlchemySearchRepository(SearchRepository):
    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        metadata = sa.MetaData()
        self.sde_manifests = sa.Table("sde_manifests", metadata, autoload_with=engine)
        self.sde_ships = sa.Table("sde_ships", metadata, autoload_with=engine)
        self.sde_blueprints = sa.Table("sde_blueprints", metadata, autoload_with=engine)
        self.industry_activities = sa.Table("sde_industry_activities", metadata, autoload_with=engine)
        self.industry_materials = sa.Table("sde_industry_materials", metadata, autoload_with=engine)
        self.industry_products = sa.Table("sde_industry_products", metadata, autoload_with=engine)
        self.blueprint_skills = sa.Table("blueprint_skill_requirements", metadata, autoload_with=engine)
        self.market_snapshots = sa.Table("market_snapshots", metadata, autoload_with=engine)

    def search_ships(self, query: str, limit: int = 25) -> List[SearchResult]:
        stmt = (
            sa.select(
                self.sde_ships.c.type_id,
                self.sde_ships.c.name,
                self.sde_manifests.c.version_label,
            )
            .join(self.sde_manifests, self.sde_manifests.c.id == self.sde_ships.c.manifest_id)
            .where(sa.func.lower(self.sde_ships.c.name).like(f"%{query.lower()}%"))
            .order_by(self.sde_ships.c.name.asc())
            .limit(limit)
        )
        with self.engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        return [
            SearchResult(
                id=str(row.type_id),
                name=row.name,
                entity="ship",
                manifest_version=row.version_label,
            )
            for row in rows
        ]

    def search_blueprints(self, query: str, limit: int = 25) -> List[SearchResult]:
        stmt = (
            sa.select(
                self.sde_blueprints.c.blueprint_type_id,
                self.sde_blueprints.c.name,
                self.sde_manifests.c.version_label,
            )
            .join(
                self.sde_manifests,
                self.sde_manifests.c.id == self.sde_blueprints.c.manifest_id,
            )
            .where(sa.func.lower(self.sde_blueprints.c.name).like(f"%{query.lower()}%"))
            .order_by(self.sde_blueprints.c.name.asc())
            .limit(limit)
        )
        with self.engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        return [
            SearchResult(
                id=str(row.blueprint_type_id),
                name=row.name,
                entity="blueprint",
                manifest_version=row.version_label,
            )
            for row in rows
        ]

    def get_blueprint_detail(self, blueprint_type_id: int, manifest_version: str) -> BlueprintDetail:
        manifest_alias = self.sde_manifests.alias()
        bp_alias = self.sde_blueprints.alias()

        with self.engine.connect() as conn:
            header = conn.execute(
                sa.select(
                    bp_alias.c.blueprint_type_id,
                    bp_alias.c.name,
                    bp_alias.c.product_type_id,
                    bp_alias.c.manifest_id,
                    manifest_alias.c.version_label,
                )
                .join(manifest_alias, manifest_alias.c.id == bp_alias.c.manifest_id)
                .where(
                    bp_alias.c.blueprint_type_id == blueprint_type_id,
                    manifest_alias.c.version_label == manifest_version,
                )
            ).fetchone()

            if header is None:
                raise ValueError(f"Blueprint {blueprint_type_id} not found for manifest {manifest_version}")

            activities_rows = conn.execute(
                sa.select(self.industry_activities).where(
                    self.industry_activities.c.blueprint_type_id == blueprint_type_id,
                    self.industry_activities.c.manifest_id == header.manifest_id,
                )
            ).fetchall()

            activity_map: Dict[int, Dict[str, object]] = {}
            for row in activities_rows:
                activity_map[row.activity_id] = {
                    "activity_id": row.activity_id,
                    "time": row.time,
                    "materials": [],
                    "products": [],
                    "skills": [],
                }

            if activity_map:
                materials = conn.execute(
                    sa.select(self.industry_materials).where(
                        self.industry_materials.c.blueprint_type_id == blueprint_type_id,
                        self.industry_materials.c.manifest_id == header.manifest_id,
                        self.industry_materials.c.activity_id.in_(activity_map.keys()),
                    )
                ).fetchall()
                for row in materials:
                    activity_map[row.activity_id]["materials"].append(
                        {"material_type_id": row.material_type_id, "quantity": row.quantity}
                    )

                products = conn.execute(
                    sa.select(self.industry_products).where(
                        self.industry_products.c.blueprint_type_id == blueprint_type_id,
                        self.industry_products.c.manifest_id == header.manifest_id,
                        self.industry_products.c.activity_id.in_(activity_map.keys()),
                    )
                ).fetchall()
                for row in products:
                    activity_map[row.activity_id]["products"].append(
                        {"product_type_id": row.product_type_id, "quantity": row.quantity}
                    )

                skills = conn.execute(
                    sa.select(self.blueprint_skills).where(
                        self.blueprint_skills.c.blueprint_type_id == blueprint_type_id,
                        self.blueprint_skills.c.manifest_id == header.manifest_id,
                        self.blueprint_skills.c.activity_id.in_(activity_map.keys()),
                    )
                ).fetchall()
                for row in skills:
                    activity_map[row.activity_id]["skills"].append(
                        {"skill_type_id": row.skill_type_id, "level": row.level}
                    )

        activities = list(activity_map.values())
        activities.sort(key=lambda entry: entry["activity_id"])

        return BlueprintDetail(
            blueprint_type_id=header.blueprint_type_id,
            name=header.name,
            product_type_id=header.product_type_id,
            manifest_version=header.version_label,
            activities=activities,
        )

    def get_market_series(
        self,
        provider: str,
        type_id: int,
        window_days: int = 7,
    ) -> List[Dict[str, object]]:
        cutoff = sa.func.now() - sa.text(f"INTERVAL '{window_days} DAYS'")
        stmt = (
            sa.select(
                self.market_snapshots.c.ts,
                self.market_snapshots.c.price,
                self.market_snapshots.c.volume,
                self.market_snapshots.c.spread,
            )
            .where(
                self.market_snapshots.c.provider == provider,
                self.market_snapshots.c.type_id == type_id,
                self.market_snapshots.c.ts >= cutoff,
            )
            .order_by(self.market_snapshots.c.ts.asc())
        )
        with self.engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        return [
            {
                "ts": row.ts.isoformat(),
                "price": float(row.price) if row.price is not None else None,
                "volume": float(row.volume) if row.volume is not None else None,
                "spread": float(row.spread) if row.spread is not None else None,
            }
            for row in rows
        ]
