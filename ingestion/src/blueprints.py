from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Mapping

import yaml


@dataclass(frozen=True)
class BlueprintActivity:
    blueprint_type_id: int
    activity: str
    time: int | None
    materials: List[dict]
    products: List[dict]
    skills: List[dict]


@dataclass(frozen=True)
class BlueprintDefinition:
    blueprint_type_id: int
    max_production_limit: int | None
    activities: List[BlueprintActivity] = field(default_factory=list)


def load_blueprints(path: Path) -> Dict[int, BlueprintDefinition]:
    raw = yaml.safe_load(path.read_text()) if path.exists() else {}
    definitions: Dict[int, BlueprintDefinition] = {}
    for bp_id_str, payload in raw.items():
        bp_id = int(payload.get("blueprintTypeID", bp_id_str))
        activities_payload: Mapping[str, Mapping] = payload.get("activities", {}) or {}
        activities: List[BlueprintActivity] = []
        for name, data in activities_payload.items():
            activities.append(
                BlueprintActivity(
                    blueprint_type_id=bp_id,
                    activity=name,
                    time=(int(data.get("time")) if data.get("time") is not None else None),
                    materials=[
                        {"type_id": int(item["typeID"]), "quantity": int(item["quantity"])}
                        for item in data.get("materials", [])
                    ],
                    products=[
                        {"type_id": int(item["typeID"]), "quantity": int(item.get("quantity", 1))}
                        for item in data.get("products", [])
                    ],
                    skills=[
                        {"type_id": int(item["typeID"]), "level": int(item.get("level", 0))}
                        for item in data.get("skills", [])
                    ],
                )
            )
        activities.sort(key=lambda act: act.activity)
        definitions[bp_id] = BlueprintDefinition(
            blueprint_type_id=bp_id,
            max_production_limit=(
                int(payload["maxProductionLimit"]) if payload.get("maxProductionLimit") is not None else None
            ),
            activities=activities,
        )
    return definitions
