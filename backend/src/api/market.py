from __future__ import annotations

from typing import Dict, List, Protocol

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from backend.src.db.repository import SQLAlchemySearchRepository
from backend.src.db.session import get_engine

router = APIRouter()


class MarketSeriesModel(BaseModel):
    provider: str
    type_id: str
    series: List[Dict[str, float | None | str]]


class MarketRepository(Protocol):
    def get_market_series(self, provider: str, type_id: int, window_days: int = 7) -> List[Dict[str, object]]:
        ...


def get_market_repository() -> MarketRepository:
    return SQLAlchemySearchRepository(get_engine())


@router.get("/market/{type_id}", response_model=MarketSeriesModel)
def market_series(
    type_id: int,
    response: Response,
    provider: str = Query("adam4eve"),
    window: int = Query(7, ge=1, le=30),
    repo: MarketRepository = Depends(get_market_repository),
) -> MarketSeriesModel:
    series = repo.get_market_series(provider=provider, type_id=type_id, window_days=window)
    if not series:
        raise HTTPException(status_code=404, detail="No market data available")
    response.headers["X-Provider"] = provider
    response.headers["X-Window"] = str(window)
    return MarketSeriesModel(provider=provider, type_id=str(type_id), series=series)
