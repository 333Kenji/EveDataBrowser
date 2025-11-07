import { z } from "zod";
import type {
  TaxonomyCategoryNode,
  TaxonomyGroupNode,
  TaxonomyTypeSummary,
  TaxonomyMarketGroupNode
} from "../domain/taxonomy.js";
import type {
  ItemCategorySummary,
  ItemGroupSummary,
  ItemMarketGroupSummary,
  ItemMetaGroupSummary,
  TypeDetail
} from "../domain/items.js";
import type {
  MarketHistoryPoint,
  MarketLatestStatsSummary
} from "../domain/market.js";

const localizedStringSchema = z.record(z.string()).describe("Localized string map keyed by language code");
const localizedStringSchemaNullable = localizedStringSchema.nullable();
const unknownRecordSchema = z.record(z.unknown()).describe("Generic JSON object derived from schema manifest");
const unknownRecordSchemaNullable = unknownRecordSchema.nullable();

export const TaxonomyGroupNodeSchema: z.ZodType<TaxonomyGroupNode> = z
  .object({
    groupKey: z.number().int().describe("groups.schema.properties._key"),
    groupId: z.number().int().nullable().describe("groups.schema.properties.groupID"),
    categoryKey: z.number().int().describe("groups.schema.properties.categoryID"),
    categoryId: z.number().int().nullable().describe("categories.schema.properties.categoryID"),
    name: localizedStringSchema.describe("groups.schema.properties.name"),
    published: z.boolean().describe("groups.schema.properties.published"),
    typeCount: z.number().int().nonnegative().describe("Derived from types.schema relationship counts")
  })
  .strict();

export const TaxonomyMarketGroupNodeSchema: z.ZodType<TaxonomyMarketGroupNode> = z
  .object({
    marketGroupKey: z.number().int().describe("marketGroups.schema.properties._key"),
    marketGroupId: z.number().int().nullable().describe("marketGroups.schema.properties.marketGroupID"),
    name: localizedStringSchema.describe("marketGroups.schema.properties.name"),
    parentGroupKey: z.number().int().nullable().describe("marketGroups.schema.properties.parentGroupID"),
  })
  .strict();

export const TaxonomyCategoryNodeSchema: z.ZodType<TaxonomyCategoryNode> = z
  .object({
    categoryKey: z.number().int().describe("categories.schema.properties._key"),
    categoryId: z.number().int().nullable().describe("categories.schema.properties.categoryID"),
    name: localizedStringSchema.describe("categories.schema.properties.name"),
    published: z.boolean().describe("categories.schema.properties.published"),
    groups: z.array(TaxonomyGroupNodeSchema).describe("Associated groups sourced from groups.schema")
  })
  .strict();

export const TaxonomyTypeSummarySchema: z.ZodType<TaxonomyTypeSummary> = z
  .object({
    typeKey: z.number().int().describe("types.schema.properties._key"),
    typeId: z.number().int().nullable().describe("types.schema.properties.typeID"),
    name: localizedStringSchema.describe("types.schema.properties.name"),
    published: z.boolean().describe("types.schema.properties.published"),
    isBlueprintManufactured: z.boolean().describe("Derived from blueprints.activities.manufacturing.products"),
    group: z
      .object({
        groupKey: z.number().int().describe("groups.schema.properties._key"),
        groupId: z.number().int().nullable().describe("groups.schema.properties.groupID"),
        name: localizedStringSchema.describe("groups.schema.properties.name"),
        categoryKey: z.number().int().describe("groups.schema.properties.categoryID"),
        categoryId: z.number().int().nullable().describe("categories.schema.properties.categoryID")
      })
      .strict()
      .describe("Subset of taxonomy group fields"),
    category: z
      .object({
        categoryKey: z.number().int().describe("categories.schema.properties._key"),
        categoryId: z.number().int().nullable().describe("categories.schema.properties.categoryID"),
        name: localizedStringSchema.describe("categories.schema.properties.name")
      })
      .strict()
      .describe("Subset of taxonomy category fields"),
    metaGroupKey: z.number().int().nullable().describe("types.schema.properties.metaGroupID (internal key)"),
    metaGroupId: z.number().int().nullable().describe("metaGroups.schema.properties.metaGroupID"),
    marketGroupKey: z.number().int().nullable().describe("marketGroups.schema.properties._key"),
    marketGroupPath: z.array(TaxonomyMarketGroupNodeSchema).describe("Ordered market group hierarchy"),
    factionId: z.number().int().nullable().describe("types.schema.properties.factionID")
  })
  .strict();

export const ItemGroupSummarySchema: z.ZodType<ItemGroupSummary> = z
  .object({
    groupKey: z.number().int().describe("groups.schema.properties._key"),
    groupId: z.number().int().nullable().describe("groups.schema.properties.groupID"),
    name: localizedStringSchema.describe("groups.schema.properties.name"),
    published: z.boolean().describe("groups.schema.properties.published")
  })
  .strict();

export const ItemCategorySummarySchema: z.ZodType<ItemCategorySummary> = z
  .object({
    categoryKey: z.number().int().describe("categories.schema.properties._key"),
    categoryId: z.number().int().nullable().describe("categories.schema.properties.categoryID"),
    name: localizedStringSchema.describe("categories.schema.properties.name"),
    published: z.boolean().describe("categories.schema.properties.published")
  })
  .strict();

export const ItemMarketGroupSummarySchema: z.ZodType<ItemMarketGroupSummary> = z
  .object({
    marketGroupKey: z.number().int().describe("marketGroups.schema.properties._key"),
    marketGroupId: z.number().int().nullable().describe("marketGroups.schema.properties.marketGroupID"),
    name: localizedStringSchema.describe("marketGroups.schema.properties.name"),
    description: z.string().nullable().describe("marketGroups.schema.properties.description"),
    parentGroupKey: z.number().int().nullable().describe("marketGroups.schema.properties.parentGroupID")
  })
  .strict();

export const ItemMetaGroupSummarySchema: z.ZodType<ItemMetaGroupSummary> = z
  .object({
    metaGroupKey: z.number().int().describe("metaGroups.schema.properties._key"),
    name: localizedStringSchema.describe("metaGroups.schema.properties.name"),
    description: localizedStringSchemaNullable.describe("metaGroups.schema.properties.description"),
    color: unknownRecordSchemaNullable.describe("metaGroups.schema.properties.color")
  })
  .strict();

export const TypeDetailSchema: z.ZodType<TypeDetail> = z
  .object({
    typeKey: z.number().int().describe("types.schema.properties._key"),
    typeId: z.number().int().nullable().describe("types.schema.properties.typeID"),
    name: localizedStringSchema.describe("types.schema.properties.name"),
    description: z.string().nullable().describe("types.schema.properties.description"),
    published: z.boolean().describe("types.schema.properties.published"),
    portionSize: z.number().int().positive().describe("types.schema.properties.portionSize"),
    basePrice: z.number().nonnegative().nullable().describe("types.schema.properties.basePrice"),
    volume: z.number().nonnegative().nullable().describe("types.schema.properties.volume"),
    mass: z.number().nonnegative().nullable().describe("types.schema.properties.mass"),
    raceId: z.number().int().nullable().describe("types.schema.properties.raceID"),
    factionId: z.number().int().nullable().describe("types.schema.properties.factionID"),
    metaLevel: z.number().int().nullable().describe("Derived from dogma attributes (Task 3.3)"),
  thumbnailUrl: z.string().min(1).nullable().describe("Derived asset URL from graphics/icon manifests"),
    group: ItemGroupSummarySchema,
    category: ItemCategorySummarySchema,
    marketGroup: ItemMarketGroupSummarySchema.nullable(),
    metaGroup: ItemMetaGroupSummarySchema.nullable()
  })
  .strict();

export const MarketHistoryPointSchema: z.ZodType<MarketHistoryPoint> = z
  .object({
    typeId: z.number().int().describe("market.priceHistory.typeId"),
    regionId: z.number().int().describe("market.priceHistory.regionId"),
    bucketStart: z.string().describe("market.priceHistory.tsBucketStart"),
    averagePrice: z.number().nonnegative().describe("market.priceHistory.averagePrice"),
    highPrice: z.number().nonnegative().describe("market.priceHistory.highPrice"),
    lowPrice: z.number().nonnegative().describe("market.priceHistory.lowPrice"),
    medianPrice: z.number().nonnegative().nullable().describe("market.priceHistory.medianPrice"),
    volume: z.number().nonnegative().describe("market.priceHistory.volume"),
    orderCount: z.number().int().nonnegative().nullable().describe("market.priceHistory.orderCount"),
    source: z.string().describe("market.priceHistory.source"),
    lastIngestedAt: z.string().describe("market.priceHistory.lastIngestedAt")
  })
  .strict();

export const MarketLatestStatsSummarySchema: z.ZodType<MarketLatestStatsSummary> = z
  .object({
    typeId: z.number().int().describe("market.latestStats.typeId"),
    regionId: z.number().int().describe("market.latestStats.regionId"),
    lastSeenAt: z.string().describe("market.latestStats.lastSeenAt"),
    snapshotLow: z.number().nonnegative().nullable().describe("market.latestStats.snapshotLow"),
    snapshotHigh: z.number().nonnegative().nullable().describe("market.latestStats.snapshotHigh"),
    snapshotMedian: z.number().nonnegative().nullable().describe("market.latestStats.snapshotMedian"),
    snapshotVolume: z.number().int().nonnegative().nullable().describe("market.latestStats.snapshotVolume"),
    source: z.string().describe("market.latestStats.source"),
    updatedAt: z.string().describe("market.latestStats.updatedAt")
  })
  .strict();

export type TaxonomyGroupNodeValidator = typeof TaxonomyGroupNodeSchema;
export type TaxonomyCategoryNodeValidator = typeof TaxonomyCategoryNodeSchema;
export type TaxonomyTypeSummaryValidator = typeof TaxonomyTypeSummarySchema;
export type TaxonomyMarketGroupNodeValidator = typeof TaxonomyMarketGroupNodeSchema;
export type TypeDetailValidator = typeof TypeDetailSchema;
export type MarketHistoryPointValidator = typeof MarketHistoryPointSchema;
export type MarketLatestStatsSummaryValidator = typeof MarketLatestStatsSummarySchema;
