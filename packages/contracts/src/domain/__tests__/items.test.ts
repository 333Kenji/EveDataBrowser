import { describe, expect, it } from "vitest";
import type {
  JsonValue,
  SdeCategoriesRow,
  SdeGroupsRow,
  SdeMarketGroupsRow,
  SdeMetaGroupsRow,
  SdeTypesRow,
} from "../../generated/domain-types.js";
import { mapTypeDetail } from "../items.js";

const en = (value: string): JsonValue => ({ en: value });

function createCategory(overrides: Partial<SdeCategoriesRow> = {}): SdeCategoriesRow {
  return {
    key: overrides.key ?? 200,
    category_id: overrides.category_id ?? 200,
    icon_id: overrides.icon_id ?? null,
    name: overrides.name ?? en("Ship"),
    published: overrides.published ?? true,
  } satisfies SdeCategoriesRow;
}

function createGroup(overrides: Partial<SdeGroupsRow> = {}): SdeGroupsRow {
  return {
    key: overrides.key ?? 100,
    group_id: overrides.group_id ?? 100,
    category_id: overrides.category_id ?? 200,
    anchorable: overrides.anchorable ?? false,
    anchored: overrides.anchored ?? false,
    fittable_non_singleton: overrides.fittable_non_singleton ?? false,
    use_base_price: overrides.use_base_price ?? false,
    icon_id: overrides.icon_id ?? null,
    name: overrides.name ?? en("Frigate"),
    published: overrides.published ?? true,
  } satisfies SdeGroupsRow;
}

function createType(overrides: Partial<SdeTypesRow> = {}): SdeTypesRow {
  return {
    key: overrides.key ?? 16227,
    type_id: overrides.type_id ?? 16227,
    group_id: overrides.group_id ?? 100,
    name: overrides.name ?? en("Test Type"),
    description: overrides.description ?? null,
    portion_size: overrides.portion_size ?? 1,
    published: overrides.published ?? true,
    market_group_id: overrides.market_group_id ?? null,
    meta_group_id: overrides.meta_group_id ?? null,
    faction_id: overrides.faction_id ?? null,
    race_id: overrides.race_id ?? null,
    mass: overrides.mass ?? null,
    volume: overrides.volume ?? null,
    base_price: overrides.base_price ?? null,
  } satisfies SdeTypesRow;
}

const nullMarketGroup: SdeMarketGroupsRow | null = null;

function createMetaGroup(overrides: Partial<SdeMetaGroupsRow> = {}): SdeMetaGroupsRow {
  return {
    key: overrides.key ?? 2,
    color: overrides.color ?? null,
    description: overrides.description ?? null,
    icon_id: overrides.icon_id ?? null,
    icon_suffix: overrides.icon_suffix ?? "t2",
    name: overrides.name ?? en("Tech II"),
  } satisfies SdeMetaGroupsRow;
}

describe("mapTypeDetail", () => {
  it("uses dogma attribute meta level when available", () => {
    const detail = mapTypeDetail({
      type: createType(),
      group: createGroup(),
      category: createCategory(),
      marketGroup: nullMarketGroup,
      metaGroup: createMetaGroup({ icon_suffix: null }),
      metaLevelValue: 9,
    });

    expect(detail.metaLevel).toBe(9);
  });

  it("falls back to meta group heuristics when dogma attribute missing", () => {
    const detail = mapTypeDetail({
      type: createType({ meta_group_id: 2 }),
      group: createGroup(),
      category: createCategory(),
      marketGroup: nullMarketGroup,
      metaGroup: createMetaGroup({ icon_suffix: "t2", name: en("Tech II") }),
      metaLevelValue: null,
    });

    expect(detail.metaLevel).toBe(5);
  });

  it("prefers render thumbnails for ship categories and icon thumbnails otherwise", () => {
    const shipDetail = mapTypeDetail({
      type: createType({ type_id: 123 }),
      group: createGroup({ name: en("Frigate") }),
      category: createCategory({ name: en("Ship") }),
      marketGroup: nullMarketGroup,
      metaGroup: null,
      metaLevelValue: null,
    });

    expect(shipDetail.thumbnailUrl).toBe("https://images.evetech.net/types/123/render?size=512");

    const moduleDetail = mapTypeDetail({
      type: createType({ type_id: 456 }),
      group: createGroup({ name: en("Module"), category_id: 201 }),
      category: createCategory({ key: 201, category_id: 201, name: en("Module") }),
      marketGroup: nullMarketGroup,
      metaGroup: null,
      metaLevelValue: null,
    });

    expect(moduleDetail.thumbnailUrl).toBe("https://images.evetech.net/types/456/icon?size=256");
  });
});