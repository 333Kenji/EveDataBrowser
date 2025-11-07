import type {
  JsonValue,
  SdeCategoriesRow,
  SdeGroupsRow,
  SdeMarketGroupsRow,
  SdeMetaGroupsRow,
  SdeTypesRow
} from "../generated/domain-types.js";
import {
  SdeCategoriesRowSchema,
  SdeGroupsRowSchema,
  SdeMarketGroupsRowSchema,
  SdeMetaGroupsRowSchema,
  SdeTypesRowSchema
} from "../generated/validation-schemas.js";
import { TypeDetailSchema } from "../validation/domain.js";
import { validateWithSchema } from "../validation/runtime.js";

/**
 * Rich item detail assembled from types.schema, groups.schema, categories.schema, marketGroups.schema, and metaGroups.schema.
 */
export interface TypeDetail {
  /** Internal surrogate key from sde_types.key */
  readonly typeKey: number;
  /** Public type identifier from types.schema.properties.typeID */
  readonly typeId: number | null;
  /** Localised type name payload */
  readonly name: Record<string, string>;
  /** Optional long-form description */
  readonly description: string | null;
  /** Publication flag from types.schema.properties.published */
  readonly published: boolean;
  /** Portion size from types.schema.properties.portionSize */
  readonly portionSize: number;
  /** Base price estimate from types.schema.properties.basePrice */
  readonly basePrice: number | null;
  /** Volume (m3) from types.schema.properties.volume */
  readonly volume: number | null;
  /** Mass (kg) from types.schema.properties.mass */
  readonly mass: number | null;
  /** Optional race identifier from types.schema.properties.raceID */
  readonly raceId: number | null;
  /** Optional faction identifier from types.schema.properties.factionID */
  readonly factionId: number | null;
  /** Optional meta level derived from dogma attributes (placeholder until Task 3.x enriches it). */
  readonly metaLevel: number | null;
  /** Optional thumbnail asset URL derived from graphics/icon joins (placeholder until Task 3.x enriches it). */
  readonly thumbnailUrl: string | null;
  /** Associated group metadata */
  readonly group: ItemGroupSummary;
  /** Associated category metadata */
  readonly category: ItemCategorySummary;
  /** Optional market group metadata */
  readonly marketGroup: ItemMarketGroupSummary | null;
  /** Optional meta group metadata */
  readonly metaGroup: ItemMetaGroupSummary | null;
}

export interface ItemGroupSummary {
  readonly groupKey: number;
  readonly groupId: number | null;
  readonly name: Record<string, string>;
  readonly published: boolean;
}

export interface ItemCategorySummary {
  readonly categoryKey: number;
  readonly categoryId: number | null;
  readonly name: Record<string, string>;
  readonly published: boolean;
}

export interface ItemMarketGroupSummary {
  readonly marketGroupKey: number;
  readonly marketGroupId: number | null;
  readonly name: Record<string, string>;
  readonly description: string | null;
  readonly parentGroupKey: number | null;
}

export interface ItemMetaGroupSummary {
  readonly metaGroupKey: number;
  readonly name: Record<string, string>;
  readonly description: Record<string, string> | null;
  readonly color: Record<string, unknown> | null;
}

export interface ItemDetailDependencies {
  readonly type: SdeTypesRow;
  readonly group: SdeGroupsRow;
  readonly category: SdeCategoriesRow;
  readonly marketGroup: SdeMarketGroupsRow | null;
  readonly metaGroup: SdeMetaGroupsRow | null;
  readonly metaLevelValue: number | null;
}

function coerceLocalizedRecord(value: JsonValue | null, label: string): Record<string, string> | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return { en: value };
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value).filter(([, entry]) => typeof entry === "string");
    if (entries.length > 0) {
      return Object.fromEntries(entries) as Record<string, string>;
    }
  }

  throw new Error(`${label} is not a localized string map`);
}

function requireLocalizedRecord(value: JsonValue, label: string): Record<string, string> {
  const record = coerceLocalizedRecord(value, label);
  if (!record) {
    throw new Error(`${label} is not a localized string map`);
  }
  return record;
}

function coerceUnknownRecord(value: JsonValue | null): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function resolveMetaLevel(metaLevelValue: number | null, metaGroup: SdeMetaGroupsRow | null): number | null {
  if (metaLevelValue != null && Number.isFinite(metaLevelValue)) {
    return metaLevelValue;
  }

  if (!metaGroup) {
    return null;
  }

  const suffix = metaGroup.icon_suffix?.toLowerCase();
  const levelBySuffix: Record<string, number | null> = {
    t2: 5,
    t3: 10,
    storyline: 7,
    faction: 8,
    officer: 14,
    deadspace: 10,
    abyssal: 16,
    premium: null,
    limited: null,
    struct_faction: 8,
    struct_t2: 5,
    struct: 0
  };

  if (suffix && suffix in levelBySuffix) {
    return levelBySuffix[suffix] ?? null;
  }

  const localized = coerceLocalizedRecord(metaGroup.name, "metaGroups.schema.properties.name");
  if (!localized) {
    return null;
  }

  const name = (localized.en ?? Object.values(localized)[0] ?? "").toLowerCase();
  const levelByName: Record<string, number | null> = {
    "tech i": 0,
    "tech 1": 0,
    "tech ii": 5,
    "tech 2": 5,
    "tech iii": 10,
    "tech 3": 10,
    storyline: 7,
    faction: 8,
    officer: 14,
    deadspace: 10,
    abyssal: 16,
    premium: null,
    "limited time": null,
    "structure faction": 8,
    "structure tech ii": 5,
    "structure tech i": 0
  };

  if (name && name in levelByName) {
    return levelByName[name] ?? null;
  }

  return null;
}

function resolveThumbnailUrl(type: SdeTypesRow, group: SdeGroupsRow, category: SdeCategoriesRow): string | null {
  const typeId = type.type_id ?? type.key;
  if (typeId) {
    const categoryName = requireLocalizedRecord(category.name, "categories.schema.properties.name");
    const englishCategory = categoryName.en?.toLowerCase();
    const renderEligible = englishCategory
      ? ["ship", "drone", "structure", "deployable"].includes(englishCategory)
      : false;
    if (renderEligible) {
      return `https://images.evetech.net/types/${typeId}/render?size=512`;
    }

    const groupName = requireLocalizedRecord(group.name, "groups.schema.properties.name");
    const englishGroup = groupName.en?.toLowerCase();
    if (englishGroup && englishGroup.includes("ship")) {
      return `https://images.evetech.net/types/${typeId}/render?size=512`;
    }

    return `https://images.evetech.net/types/${typeId}/icon?size=256`;
  }

  return null;
}

export function mapTypeDetail({
  type,
  group,
  category,
  marketGroup,
  metaGroup,
  metaLevelValue
}: ItemDetailDependencies): TypeDetail {
  const validatedType = validateWithSchema(SdeTypesRowSchema, type, "types.schema row");
  const validatedGroup = validateWithSchema(SdeGroupsRowSchema, group, "groups.schema row");
  const validatedCategory = validateWithSchema(SdeCategoriesRowSchema, category, "categories.schema row");
  const validatedMarketGroup = marketGroup
    ? validateWithSchema(SdeMarketGroupsRowSchema, marketGroup, "marketGroups.schema row")
    : null;
  const validatedMetaGroup = metaGroup
    ? validateWithSchema(SdeMetaGroupsRowSchema, metaGroup, "metaGroups.schema row")
    : null;

  const detail: TypeDetail = {
    typeKey: validatedType.key,
    typeId: validatedType.type_id,
    name: requireLocalizedRecord(validatedType.name, "types.schema.properties.name"),
    description: validatedType.description,
    published: validatedType.published,
    portionSize: validatedType.portion_size,
    basePrice: validatedType.base_price,
    volume: validatedType.volume,
    mass: validatedType.mass,
  raceId: validatedType.race_id,
  factionId: validatedType.faction_id,
  metaLevel: resolveMetaLevel(metaLevelValue, validatedMetaGroup),
  thumbnailUrl: resolveThumbnailUrl(validatedType, validatedGroup, validatedCategory),
    group: {
      groupKey: validatedGroup.key,
      groupId: validatedGroup.group_id,
      name: requireLocalizedRecord(validatedGroup.name, "groups.schema.properties.name"),
      published: validatedGroup.published
    },
    category: {
      categoryKey: validatedCategory.key,
      categoryId: validatedCategory.category_id,
      name: requireLocalizedRecord(validatedCategory.name, "categories.schema.properties.name"),
      published: validatedCategory.published
    },
    marketGroup: validatedMarketGroup
      ? {
          marketGroupKey: validatedMarketGroup.key,
          marketGroupId: validatedMarketGroup.market_group_id,
          name: requireLocalizedRecord(validatedMarketGroup.name, "marketGroups.schema.properties.name"),
          description: validatedMarketGroup.description,
          parentGroupKey: validatedMarketGroup.parent_group_id
        }
      : null,
    metaGroup: validatedMetaGroup
      ? {
          metaGroupKey: validatedMetaGroup.key,
          name: requireLocalizedRecord(validatedMetaGroup.name, "metaGroups.schema.properties.name"),
          description: coerceLocalizedRecord(validatedMetaGroup.description, "metaGroups.schema.properties.description"),
          color: coerceUnknownRecord(validatedMetaGroup.color)
        }
      : null
  };

  return validateWithSchema(TypeDetailSchema, detail, "item type detail");
}
