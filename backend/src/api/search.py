from __future__ import annotations

from dataclasses import dataclass
from typing import List, Protocol

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel

router = APIRouter()


@dataclass(frozen=True)
class SearchResult:
    id: str
    name: str
    entity: str
    manifest_version: str


class SearchItem(BaseModel):
    id: str
    name: str
    entity: str

    @classmethod
    def from_result(cls, result: SearchResult) -> "SearchItem":
        return cls(id=result.id, name=result.name, entity=result.entity)


class SearchResponse(BaseModel):
    entity: str
    items: List[SearchItem]


class SearchRepository(Protocol):
    def search_ships(self, query: str, limit: int = 25) -> List[SearchResult]: ...

    def search_blueprints(self, query: str, limit: int = 25) -> List[SearchResult]: ...


class EmptySearchRepository:
    def search_ships(self, query: str, limit: int = 25) -> List[SearchResult]:
        return []

    def search_blueprints(self, query: str, limit: int = 25) -> List[SearchResult]:
        return []


def get_search_repository() -> SearchRepository:
    try:
        from backend.src.db.repository import SQLAlchemySearchRepository
        from backend.src.db.session import get_engine

        return SQLAlchemySearchRepository(get_engine())
    except Exception:
        return EmptySearchRepository()


@router.get("/search", response_model=SearchResponse)
def search(
    response: Response,
    q: str = Query("", description="Search term"),
    entity: str = Query("ships", pattern="^(ships|blueprints)$"),
    repo: SearchRepository = Depends(get_search_repository),
) -> SearchResponse:
    if entity == "blueprints":
        results = repo.search_blueprints(q)
    else:
        results = repo.search_ships(q)
    manifest_version = results[0].manifest_version if results else "unknown"
    response.headers["X-Manifest-Version"] = manifest_version
    items = [SearchItem.from_result(result) for result in results]
    return SearchResponse(entity=entity, items=items)
