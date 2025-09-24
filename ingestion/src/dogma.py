from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Mapping

import yaml


@dataclass(frozen=True)
class DogmaAttributeDefinition:
    attribute_id: int
    name: str
    high_is_good: bool | None
    unit_id: int | None


@dataclass(frozen=True)
class DogmaUnit:
    unit_id: int
    symbol: str | None


@dataclass(frozen=True)
class DogmaStat:
    type_id: int
    attribute_id: int
    attribute_name: str
    value: float
    unit_symbol: str | None
    high_is_good: bool | None


def _load_yaml(path: Path) -> Mapping:
    return yaml.safe_load(path.read_text()) if path.exists() else {}


def load_type_dogma(path: Path) -> Dict[int, Dict[int, float]]:
    raw = _load_yaml(path)
    result: Dict[int, Dict[int, float]] = {}
    for type_id_str, payload in raw.items():
        type_id = int(type_id_str)
        attrs: Dict[int, float] = {}
        for item in payload.get("dogmaAttributes", []):
            attrs[int(item["attributeID"])] = float(item["value"])
        result[type_id] = attrs
    return result


def load_attribute_definitions(path: Path) -> Dict[int, DogmaAttributeDefinition]:
    raw = _load_yaml(path)
    definitions: Dict[int, DogmaAttributeDefinition] = {}
    for attr_id_str, payload in raw.items():
        attr_id = int(payload.get("attributeID", attr_id_str))
        definitions[attr_id] = DogmaAttributeDefinition(
            attribute_id=attr_id,
            name=str(payload.get("name", "")),
            high_is_good=payload.get("highIsGood"),
            unit_id=(int(payload["unitID"]) if payload.get("unitID") is not None else None),
        )
    return definitions


def load_dogma_units(path: Path) -> Dict[int, DogmaUnit]:
    raw = _load_yaml(path)
    units: Dict[int, DogmaUnit] = {}
    for unit_id_str, payload in raw.items():
        unit_id = int(payload.get("unitID", unit_id_str))
        symbol = payload.get("symbol")
        if symbol is None and isinstance(payload.get("displayName"), dict):
            symbol = payload["displayName"].get("en")
        units[unit_id] = DogmaUnit(unit_id=unit_id, symbol=symbol)
    return units


def resolve_ship_attributes(
    type_dogma: Mapping[int, Mapping[int, float]],
    definitions: Mapping[int, DogmaAttributeDefinition],
    units: Mapping[int, DogmaUnit],
) -> Dict[int, List[DogmaStat]]:
    resolved: Dict[int, List[DogmaStat]] = {}
    for type_id, attrs in type_dogma.items():
        stats: List[DogmaStat] = []
        for attribute_id, value in attrs.items():
            definition = definitions.get(attribute_id)
            if not definition:
                continue
            unit_symbol = None
            if definition.unit_id is not None:
                unit = units.get(definition.unit_id)
                if unit:
                    unit_symbol = unit.symbol
            stats.append(
                DogmaStat(
                    type_id=type_id,
                    attribute_id=attribute_id,
                    attribute_name=definition.name,
                    value=value,
                    unit_symbol=unit_symbol,
                    high_is_good=definition.high_is_good,
                )
            )
        stats.sort(key=lambda s: s.attribute_id)
        resolved[type_id] = stats
    return resolved
