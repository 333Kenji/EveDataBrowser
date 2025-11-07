import type { SdeCategoriesRow, SdeGroupsRow, SdeTypesRow } from "../generated/domain-types.js";
import {
  TaxonomyCategoryNodeSchema,
  TaxonomyTypeSummarySchema,
  TaxonomyGroupNodeSchema,
  TaxonomyMarketGroupNodeSchema
} from "../validation/domain.js";
import { validateWithSchema } from "../validation/runtime.js";

/**
 * Category hierarchy node derived from sde_categories (categories.schema) and sde_groups (groups.schema).
 * Fields retain the original schema hash context exposed in persistence/manifests/schema-manifest.json.
 */
export interface TaxonomyCategoryNode {
  /** Numeric surrogate key from sde_categories.key */
  readonly categoryKey: number;
  /** Public-facing identifier from categories.schema.properties.categoryID */
  readonly categoryId: number | null;
  /** Localised category names from categories.schema.properties.name */
  readonly name: Record<string, string>;
  /** Publication flag from categories.schema.properties.published */
  readonly published: boolean;
  /** Associated groups ordered by group identifier. */
  readonly groups: ReadonlyArray<TaxonomyGroupNode>;
}

/**
 * Group node enriched with relationship metadata sourced from groups.schema.
 */
export interface TaxonomyGroupNode {
  /** Numeric surrogate key from sde_groups.key */
  readonly groupKey: number;
  /** Public-facing identifier from groups.schema.properties.groupID */
  readonly groupId: number | null;
  /** Back-reference to owning category key */
  readonly categoryKey: number;
  /** Back-reference to owning category identifier */
  readonly categoryId: number | null;
  /** Localised group names from groups.schema.properties.name */
  readonly name: Record<string, string>;
  /** Publication flag from groups.schema.properties.published */
  readonly published: boolean;
  /** Count of published types within the group */
  readonly typeCount: number;
}

/**
 * Lightweight taxonomy type summary matching types.schema and related joins.
 */
export interface TaxonomyTypeSummary {
  /** Surrogate key from sde_types.key */
  readonly typeKey: number;
  /** Public-facing identifier from types.schema.properties.typeID */
  readonly typeId: number | null;
  /** Localised type names from types.schema.properties.name */
  readonly name: Record<string, string>;
  /** Publication flag from types.schema.properties.published */
  readonly published: boolean;
  /** True when at least one blueprint manufactures this type via the manufacturing activity */
  readonly isBlueprintManufactured: boolean;
  /** Owning group metadata */
  readonly group: Pick<TaxonomyGroupNode, "groupKey" | "groupId" | "name" | "categoryKey" | "categoryId">;
  /** Owning category metadata */
  readonly category: Pick<TaxonomyCategoryNode, "categoryKey" | "categoryId" | "name">;
  /** Optional meta group identifier from types.schema.properties.metaGroupID */
  readonly metaGroupKey: number | null;
  /** Optional meta group identifier (public) resolved from metaGroups.schema.properties.metaGroupID */
  readonly metaGroupId: number | null;
  /** Optional market group key referencing sde_market_groups.key */
  readonly marketGroupKey: number | null;
  /** Ordered market group hierarchy derived from sde_market_groups.parent_group_id */
  readonly marketGroupPath: ReadonlyArray<TaxonomyMarketGroupNode>;
  /** Optional faction identifier from types.schema.properties.factionID */
  readonly factionId: number | null;
}

export interface TaxonomyMarketGroupNode {
  readonly marketGroupKey: number;
  readonly marketGroupId: number | null;
  readonly name: Record<string, string>;
  readonly parentGroupKey: number | null;
}

function requireLocalizedRecord(value: unknown, label: string): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.every(([, v]) => typeof v === "string")) {
      return value as Record<string, string>;
    }
  }
  throw new Error(`${label} is not a localized string map`);
}

/**
 * Adapts a raw category + group recordset into a structured hierarchy.
 */
export function mapCategoryRowToNode(
  category: SdeCategoriesRow,
  groups: ReadonlyArray<{ group: SdeGroupsRow; typeCount: number }>
): TaxonomyCategoryNode {
  const mappedGroups = groups
    .map(({ group, typeCount }) => {
      const node: TaxonomyGroupNode = {
        groupKey: group.key,
        groupId: group.group_id,
        categoryKey: category.key,
        categoryId: category.category_id,
        name: requireLocalizedRecord(group.name, "groups.schema.properties.name"),
        published: group.published,
        typeCount
      };
      return validateWithSchema(TaxonomyGroupNodeSchema, node, "taxonomy group node");
    })
    .sort((a, b) => (a.groupId ?? a.groupKey) - (b.groupId ?? b.groupKey));

  const categoryNode: TaxonomyCategoryNode = {
    categoryKey: category.key,
    categoryId: category.category_id,
    name: requireLocalizedRecord(category.name, "categories.schema.properties.name"),
    published: category.published,
    groups: mappedGroups
  };

  return validateWithSchema(TaxonomyCategoryNodeSchema, categoryNode, "taxonomy category node");
}

/**
 * Helper for assembling type summaries from denormalised join rows.
 */
export function mapTypeSummaryRow(
  row: {
    type: SdeTypesRow;
    group: SdeGroupsRow;
    category: SdeCategoriesRow;
    metaGroupKey: number | null;
    metaGroupId: number | null;
    marketGroupKey: number | null;
    marketGroupPath: ReadonlyArray<TaxonomyMarketGroupNode>;
    isBlueprintManufactured: boolean;
  }
): TaxonomyTypeSummary {
  const summary: TaxonomyTypeSummary = {
    typeKey: row.type.key,
    typeId: row.type.type_id,
    name: requireLocalizedRecord(row.type.name, "types.schema.properties.name"),
    published: Boolean(row.type.published),
    isBlueprintManufactured: Boolean(row.isBlueprintManufactured),
    group: {
      groupKey: row.group.key,
      groupId: row.group.group_id,
      name: requireLocalizedRecord(row.group.name, "groups.schema.properties.name"),
      categoryKey: row.category.key,
      categoryId: row.category.category_id
    },
    category: {
      categoryKey: row.category.key,
      categoryId: row.category.category_id,
      name: requireLocalizedRecord(row.category.name, "categories.schema.properties.name")
    },
    metaGroupKey: row.metaGroupKey,
    metaGroupId: row.metaGroupId,
    marketGroupKey: row.marketGroupKey,
    marketGroupPath: row.marketGroupPath,
    factionId: row.type.faction_id
  };

  return validateWithSchema(TaxonomyTypeSummarySchema, summary, "taxonomy type summary");
}
