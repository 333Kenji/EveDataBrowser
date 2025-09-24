from fastapi import FastAPI

from backend.src.api.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(title="Eve Data Browser API")
    app.include_router(health_router)
    return app


app = create_app()
