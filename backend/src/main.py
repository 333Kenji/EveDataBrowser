from fastapi import FastAPI

from backend.src.api.health import router as health_router
from backend.src.api.search import router as search_router
from backend.src.api.blueprints import router as blueprints_router
from backend.src.api.market import router as market_router


def create_app() -> FastAPI:
    app = FastAPI(title="Eve Data Browser API")
    app.include_router(health_router)
    app.include_router(search_router)
    app.include_router(blueprints_router)
    app.include_router(market_router)
    return app


app = create_app()
