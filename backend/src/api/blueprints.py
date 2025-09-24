from __future__ import annotations

from typing import Any, Dict, List, Protocol

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.src.db.repository import BlueprintDetail, SQLAlchemySearchRepository
from backend.src.db.session import get_engine

router = APIRouter()


class BlueprintDetailModel(BaseModel):
    blueprint_type_id: str
    name: str
    product_type_id: str
    manifest_version: str
    activities: List[Dict[str, Any]]


class BlueprintRepository(Protocol):
    def get_blueprint_detail(
        self, blueprint_type_id: int, manifest_version: str | None = None
    ) -> BlueprintDetail:
        ...


def get_blueprint_repository() -> BlueprintRepository:
    return SQLAlchemySearchRepository(get_engine())


@router.get("/blueprints/{blueprint_type_id}", response_model=BlueprintDetailModel)
def blueprint_detail(
    blueprint_type_id: int,
    repo: BlueprintRepository = Depends(get_blueprint_repository),
) -> BlueprintDetailModel:
    try:
        detail = repo.get_blueprint_detail(blueprint_type_id, manifest_version=None)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return BlueprintDetailModel(
        blueprint_type_id=str(detail.blueprint_type_id),
        name=detail.name,
        product_type_id=str(detail.product_type_id),
        manifest_version=detail.manifest_version,
        activities=detail.activities,
    )
