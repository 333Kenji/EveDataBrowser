from __future__ import annotations

from pathlib import Path

import yaml

from ingestion.src.dogma import (
    DogmaStat,
    load_attribute_definitions,
    load_dogma_units,
    load_type_dogma,
    resolve_ship_attributes,
)


def _write_yaml(path: Path, payload: object) -> Path:
    path.write_text(yaml.safe_dump(payload))
    return path


def test_resolve_ship_attributes(tmp_path: Path) -> None:
    type_dogma_path = _write_yaml(
        tmp_path / "typeDogma.yaml",
        {
            603: {
                "dogmaAttributes": [
                    {"attributeID": 9, "value": 125.0},
                    {"attributeID": 30, "value": 900.0},
                ]
            }
        },
    )
    attributes_path = _write_yaml(
        tmp_path / "dogmaAttributes.yaml",
        {
            9: {
                "attributeID": 9,
                "name": "hiSlots",
                "highIsGood": True,
                "unitID": None,
            },
            30: {
                "attributeID": 30,
                "name": "maxVelocity",
                "highIsGood": True,
                "unitID": 101,
            },
        },
    )
    units_path = _write_yaml(
        tmp_path / "dogmaUnits.yaml",
        {
            101: {
                "unitID": 101,
                "displayName": {"en": "m/s"},
                "symbol": "m/s",
            }
        },
    )

    dogma = load_type_dogma(type_dogma_path)
    attributes = load_attribute_definitions(attributes_path)
    units = load_dogma_units(units_path)

    results = resolve_ship_attributes(dogma, attributes, units)

    assert results[603] == [
        DogmaStat(
            type_id=603,
            attribute_id=9,
            attribute_name="hiSlots",
            value=125.0,
            unit_symbol=None,
            high_is_good=True,
        ),
        DogmaStat(
            type_id=603,
            attribute_id=30,
            attribute_name="maxVelocity",
            value=900.0,
            unit_symbol="m/s",
            high_is_good=True,
        ),
    ]
