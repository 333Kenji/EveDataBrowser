from __future__ import annotations

from typing import List

import pytest
from fastapi.testclient import TestClient

from backend.src.api.blueprints import BlueprintDetailModel, get_blueprint_repository
from backend.src.main import create_app


class StubBlueprintRepo:
    def __init__(self, detail: BlueprintDetailModel) -> None:
        self._detail = detail

    def get_blueprint_detail(self, blueprint_type_id: int, manifest_version: str | None = None):
        if blueprint_type_id != int(self._detail.blueprint_type_id):
            raise ValueError("not found")
        return self._detail


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    detail = BlueprintDetailModel(
        blueprint_type_id="1001",
        name="Merlin Blueprint",
        product_type_id="603",
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
    app.dependency_overrides[get_blueprint_repository] = lambda: StubBlueprintRepo(detail)
    return TestClient(app)


def test_blueprint_detail_success(client: TestClient) -> None:
    response = client.get("/blueprints/1001")
    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "Merlin Blueprint"
    assert payload["manifest_version"] == "sde-test-blueprint"


def test_blueprint_detail_not_found(client: TestClient) -> None:
    response = client.get("/blueprints/9999")
    assert response.status_code == 404
