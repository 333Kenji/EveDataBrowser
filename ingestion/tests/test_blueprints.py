from __future__ import annotations

from pathlib import Path

import yaml

from ingestion.src.blueprints import (
    BlueprintActivity,
    BlueprintDefinition,
    load_blueprints,
)


def _write_yaml(path: Path, payload: object) -> Path:
    path.write_text(yaml.safe_dump(payload))
    return path


def test_load_blueprints_returns_activity_structures(tmp_path: Path) -> None:
    blueprint_path = _write_yaml(
        tmp_path / "blueprints.yaml",
        {
            1001: {
                "blueprintTypeID": 1001,
                "maxProductionLimit": 300,
                "activities": {
                    "manufacturing": {
                        "materials": [
                            {"typeID": 34, "quantity": 100},
                            {"typeID": 35, "quantity": 20},
                        ],
                        "products": [
                            {"typeID": 2001, "quantity": 1},
                        ],
                        "skills": [
                            {"typeID": 3380, "level": 3},
                        ],
                        "time": 1200,
                    }
                },
            }
        },
    )

    blueprints = load_blueprints(blueprint_path)

    assert blueprints[1001] == BlueprintDefinition(
        blueprint_type_id=1001,
        max_production_limit=300,
        activities=[
            BlueprintActivity(
                blueprint_type_id=1001,
                activity="manufacturing",
                time=1200,
                materials=[{"type_id": 34, "quantity": 100}, {"type_id": 35, "quantity": 20}],
                products=[{"type_id": 2001, "quantity": 1}],
                skills=[{"type_id": 3380, "level": 3}],
            )
        ],
    )
