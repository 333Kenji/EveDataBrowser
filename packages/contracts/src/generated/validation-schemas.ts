// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from persistence/manifests/schema-manifest.json
// Schema hash: e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac
// Generated at: 2025-10-13T00:45:00Z

import { z } from "zod";
import type { JsonValue, ItemPricesFactRow, MarketHistoryRefreshCacheRow, MarketLatestStatsRow, MarketPriceHistoryRow, SdeCategoriesRow, SdeGroupsRow, SdeMarketGroupsRow, SdeMasterMaterialsRow, SdeMasterProductsRow, SdeMetaGroupsRow, SdeTypesRow, StructureOrdersRow } from "./domain-types.js";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(jsonValueSchema)
]));

export const ItemPricesFactRowSchema: z.ZodType<ItemPricesFactRow> = z.object({
  type_id: z.number().int().describe("Column public.item_prices_fact.type_id – data/schema/combined-schema-reference.json#/tables/itemPricesFact"),
  average: z.string().nullable().describe("Column public.item_prices_fact.average – data/schema/combined-schema-reference.json#/tables/itemPricesFact"),
  adjusted: z.string().nullable().describe("Column public.item_prices_fact.adjusted – data/schema/combined-schema-reference.json#/tables/itemPricesFact"),
  updated_at: z.string().describe("Column public.item_prices_fact.updated_at – data/schema/combined-schema-reference.json#/tables/itemPricesFact"),
}).strict().describe("public.item_prices_fact (data/schema/combined-schema-reference.json#/tables/itemPricesFact)");
export const MarketHistoryRefreshCacheRowSchema: z.ZodType<MarketHistoryRefreshCacheRow> = z.object({
  type_id: z.number().int().describe("Column public.market_history_refresh_cache.type_id – data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache"),
  region_id: z.number().int().describe("Column public.market_history_refresh_cache.region_id – data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache"),
  cached_until: z.string().nullable().describe("Column public.market_history_refresh_cache.cached_until – data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache"),
  last_checked_at: z.string().nullable().describe("Column public.market_history_refresh_cache.last_checked_at – data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache"),
}).strict().describe("public.market_history_refresh_cache (data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache)");
export const MarketLatestStatsRowSchema: z.ZodType<MarketLatestStatsRow> = z.object({
  type_id: z.number().int().describe("Column public.market_latest_stats.type_id – data/schema/combined-schema-reference.json#/tables/marketLatestStats"),
  region_id: z.number().int().describe("Column public.market_latest_stats.region_id – data/schema/combined-schema-reference.json#/tables/marketLatestStats"),
  last_seen_at: z.string().describe("Column public.market_latest_stats.last_seen_at – data/schema/combined-schema-reference.json#/tables/marketLatestStats"),
  snapshot_low: z.number().nullable().describe("Column public.market_latest_stats.snapshot_low – data/schema/combined-schema-reference.json#/tables/marketLatestStats"),
  snapshot_high: z.number().nullable().describe("Column public.market_latest_stats.snapshot_high – data/schema/combined-schema-reference.json#/tables/marketLatestStats"),
  snapshot_median: z.number().nullable().describe("Column public.market_latest_stats.snapshot_median – data/schema/combined-schema-reference.json#/tables/marketLatestStats"),
  snapshot_volume: z.number().nullable().describe("Column public.market_latest_stats.snapshot_volume – data/schema/combined-schema-reference.json#/tables/marketLatestStats"),
  source: z.string().describe("Column public.market_latest_stats.source – data/schema/combined-schema-reference.json#/tables/marketLatestStats"),
  updated_at: z.string().describe("Column public.market_latest_stats.updated_at – data/schema/combined-schema-reference.json#/tables/marketLatestStats"),
}).strict().describe("public.market_latest_stats (data/schema/combined-schema-reference.json#/tables/marketLatestStats)");
export const MarketPriceHistoryRowSchema: z.ZodType<MarketPriceHistoryRow> = z.object({
  type_id: z.number().int().describe("Column public.market_price_history.type_id – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  region_id: z.number().int().describe("Column public.market_price_history.region_id – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  ts_bucket_start: z.string().describe("Column public.market_price_history.ts_bucket_start – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  average_price: z.number().describe("Column public.market_price_history.average_price – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  high_price: z.number().describe("Column public.market_price_history.high_price – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  low_price: z.number().describe("Column public.market_price_history.low_price – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  median_price: z.number().nullable().describe("Column public.market_price_history.median_price – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  volume: z.number().describe("Column public.market_price_history.volume – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  order_count: z.number().nullable().describe("Column public.market_price_history.order_count – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  source: z.string().describe("Column public.market_price_history.source – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
  last_ingested_at: z.string().describe("Column public.market_price_history.last_ingested_at – data/schema/combined-schema-reference.json#/tables/marketPriceHistory"),
}).strict().describe("public.market_price_history (data/schema/combined-schema-reference.json#/tables/marketPriceHistory)");
export const SdeCategoriesRowSchema: z.ZodType<SdeCategoriesRow> = z.object({
  key: z.number().int().describe("Column sde_master.sde_categories.key – data/schema/combined-schema-reference.json#/tables/categories"),
  category_id: z.number().int().nullable().describe("Column sde_master.sde_categories.category_id – data/schema/combined-schema-reference.json#/tables/categories"),
  name: jsonValueSchema.describe("Column sde_master.sde_categories.name – data/schema/combined-schema-reference.json#/tables/categories"),
  published: z.boolean().describe("Column sde_master.sde_categories.published – data/schema/combined-schema-reference.json#/tables/categories"),
  icon_id: z.number().int().nullable().describe("Column sde_master.sde_categories.icon_id – data/schema/combined-schema-reference.json#/tables/categories"),
}).strict().describe("sde_master.sde_categories (data/schema/combined-schema-reference.json#/tables/categories)");
export const SdeGroupsRowSchema: z.ZodType<SdeGroupsRow> = z.object({
  key: z.number().int().describe("Column sde_master.sde_groups.key – data/schema/combined-schema-reference.json#/tables/groups"),
  group_id: z.number().int().nullable().describe("Column sde_master.sde_groups.group_id – data/schema/combined-schema-reference.json#/tables/groups"),
  category_id: z.number().int().nullable().describe("Column sde_master.sde_groups.category_id – data/schema/combined-schema-reference.json#/tables/groups"),
  name: jsonValueSchema.describe("Column sde_master.sde_groups.name – data/schema/combined-schema-reference.json#/tables/groups"),
  published: z.boolean().describe("Column sde_master.sde_groups.published – data/schema/combined-schema-reference.json#/tables/groups"),
  anchorable: z.boolean().describe("Column sde_master.sde_groups.anchorable – data/schema/combined-schema-reference.json#/tables/groups"),
  anchored: z.boolean().describe("Column sde_master.sde_groups.anchored – data/schema/combined-schema-reference.json#/tables/groups"),
  fittable_non_singleton: z.boolean().describe("Column sde_master.sde_groups.fittable_non_singleton – data/schema/combined-schema-reference.json#/tables/groups"),
  use_base_price: z.boolean().describe("Column sde_master.sde_groups.use_base_price – data/schema/combined-schema-reference.json#/tables/groups"),
  icon_id: z.number().int().nullable().describe("Column sde_master.sde_groups.icon_id – data/schema/combined-schema-reference.json#/tables/groups"),
}).strict().describe("sde_master.sde_groups (data/schema/combined-schema-reference.json#/tables/groups)");
export const SdeMarketGroupsRowSchema: z.ZodType<SdeMarketGroupsRow> = z.object({
  key: z.number().int().describe("Column sde_master.sde_market_groups.key – data/schema/combined-schema-reference.json#/tables/marketGroups"),
  market_group_id: z.number().int().nullable().describe("Column sde_master.sde_market_groups.market_group_id – data/schema/combined-schema-reference.json#/tables/marketGroups"),
  name: jsonValueSchema.describe("Column sde_master.sde_market_groups.name – data/schema/combined-schema-reference.json#/tables/marketGroups"),
  description: z.string().nullable().describe("Column sde_master.sde_market_groups.description – data/schema/combined-schema-reference.json#/tables/marketGroups"),
  parent_group_id: z.number().int().nullable().describe("Column sde_master.sde_market_groups.parent_group_id – data/schema/combined-schema-reference.json#/tables/marketGroups"),
  has_types: z.boolean().describe("Column sde_master.sde_market_groups.has_types – data/schema/combined-schema-reference.json#/tables/marketGroups"),
  icon_id: z.number().int().nullable().describe("Column sde_master.sde_market_groups.icon_id – data/schema/combined-schema-reference.json#/tables/marketGroups"),
}).strict().describe("sde_master.sde_market_groups (data/schema/combined-schema-reference.json#/tables/marketGroups)");
export const SdeMasterMaterialsRowSchema: z.ZodType<SdeMasterMaterialsRow> = z.object({
  material_type_id: z.number().int().describe("Column sde_master.sde_master_materials.material_type_id – data/schema/combined-schema-reference.json#/tables/materials"),
  product_type_id: z.number().int().describe("Column sde_master.sde_master_materials.product_type_id – data/schema/combined-schema-reference.json#/tables/materials"),
  blueprint_type_id: z.number().int().describe("Column sde_master.sde_master_materials.blueprint_type_id – data/schema/combined-schema-reference.json#/tables/materials"),
  activity: z.string().describe("Column sde_master.sde_master_materials.activity – data/schema/combined-schema-reference.json#/tables/materials"),
  material_quantity: z.number().int().describe("Column sde_master.sde_master_materials.material_quantity – data/schema/combined-schema-reference.json#/tables/materials"),
  created_at: z.string().describe("Column sde_master.sde_master_materials.created_at – data/schema/combined-schema-reference.json#/tables/materials"),
  updated_at: z.string().describe("Column sde_master.sde_master_materials.updated_at – data/schema/combined-schema-reference.json#/tables/materials"),
}).strict().describe("sde_master.sde_master_materials (data/schema/combined-schema-reference.json#/tables/materials)");
export const SdeMasterProductsRowSchema: z.ZodType<SdeMasterProductsRow> = z.object({
  product_type_id: z.number().int().describe("Column sde_master.sde_master_products.product_type_id – data/schema/combined-schema-reference.json#/tables/products"),
  blueprint_type_id: z.number().int().describe("Column sde_master.sde_master_products.blueprint_type_id – data/schema/combined-schema-reference.json#/tables/products"),
  activity: z.string().describe("Column sde_master.sde_master_products.activity – data/schema/combined-schema-reference.json#/tables/products"),
  product_quantity: z.number().int().describe("Column sde_master.sde_master_products.product_quantity – data/schema/combined-schema-reference.json#/tables/products"),
  manufacturing_time: z.number().int().describe("Column sde_master.sde_master_products.manufacturing_time – data/schema/combined-schema-reference.json#/tables/products"),
  max_production_limit: z.number().int().nullable().describe("Column sde_master.sde_master_products.max_production_limit – data/schema/combined-schema-reference.json#/tables/products"),
  created_at: z.string().describe("Column sde_master.sde_master_products.created_at – data/schema/combined-schema-reference.json#/tables/products"),
  updated_at: z.string().describe("Column sde_master.sde_master_products.updated_at – data/schema/combined-schema-reference.json#/tables/products"),
}).strict().describe("sde_master.sde_master_products (data/schema/combined-schema-reference.json#/tables/products)");
export const SdeMetaGroupsRowSchema: z.ZodType<SdeMetaGroupsRow> = z.object({
  key: z.number().int().describe("Column sde_master.sde_meta_groups.key – data/schema/combined-schema-reference.json#/tables/metaGroups"),
  name: jsonValueSchema.describe("Column sde_master.sde_meta_groups.name – data/schema/combined-schema-reference.json#/tables/metaGroups"),
  description: jsonValueSchema.nullable().describe("Column sde_master.sde_meta_groups.description – data/schema/combined-schema-reference.json#/tables/metaGroups"),
  color: jsonValueSchema.nullable().describe("Column sde_master.sde_meta_groups.color – data/schema/combined-schema-reference.json#/tables/metaGroups"),
  icon_suffix: z.string().nullable().describe("Column sde_master.sde_meta_groups.icon_suffix – data/schema/combined-schema-reference.json#/tables/metaGroups"),
  icon_id: z.number().int().nullable().describe("Column sde_master.sde_meta_groups.icon_id – data/schema/combined-schema-reference.json#/tables/metaGroups"),
}).strict().describe("sde_master.sde_meta_groups (data/schema/combined-schema-reference.json#/tables/metaGroups)");
export const SdeTypesRowSchema: z.ZodType<SdeTypesRow> = z.object({
  key: z.number().int().describe("Column sde_master.sde_types.key – data/schema/combined-schema-reference.json#/tables/types"),
  type_id: z.number().int().nullable().describe("Column sde_master.sde_types.type_id – data/schema/combined-schema-reference.json#/tables/types"),
  group_id: z.number().int().describe("Column sde_master.sde_types.group_id – data/schema/combined-schema-reference.json#/tables/types"),
  name: jsonValueSchema.describe("Column sde_master.sde_types.name – data/schema/combined-schema-reference.json#/tables/types"),
  description: z.string().nullable().describe("Column sde_master.sde_types.description – data/schema/combined-schema-reference.json#/tables/types"),
  published: z.boolean().describe("Column sde_master.sde_types.published – data/schema/combined-schema-reference.json#/tables/types"),
  portion_size: z.number().int().describe("Column sde_master.sde_types.portion_size – data/schema/combined-schema-reference.json#/tables/types"),
  base_price: z.number().nullable().describe("Column sde_master.sde_types.base_price – data/schema/combined-schema-reference.json#/tables/types"),
  volume: z.number().nullable().describe("Column sde_master.sde_types.volume – data/schema/combined-schema-reference.json#/tables/types"),
  mass: z.number().nullable().describe("Column sde_master.sde_types.mass – data/schema/combined-schema-reference.json#/tables/types"),
  race_id: z.number().int().nullable().describe("Column sde_master.sde_types.race_id – data/schema/combined-schema-reference.json#/tables/types"),
  faction_id: z.number().int().nullable().describe("Column sde_master.sde_types.faction_id – data/schema/combined-schema-reference.json#/tables/types"),
  market_group_id: z.number().int().nullable().describe("Column sde_master.sde_types.market_group_id – data/schema/combined-schema-reference.json#/tables/types"),
  meta_group_id: z.number().int().nullable().describe("Column sde_master.sde_types.meta_group_id – data/schema/combined-schema-reference.json#/tables/types"),
}).strict().describe("sde_master.sde_types (data/schema/combined-schema-reference.json#/tables/types)");
export const StructureOrdersRowSchema: z.ZodType<StructureOrdersRow> = z.object({
  structure_id: z.number().int().describe("Column public.structure_orders.structure_id – data/schema/combined-schema-reference.json#/tables/structureOrders"),
  order_id: z.number().int().describe("Column public.structure_orders.order_id – data/schema/combined-schema-reference.json#/tables/structureOrders"),
  type_id: z.number().int().describe("Column public.structure_orders.type_id – data/schema/combined-schema-reference.json#/tables/structureOrders"),
  is_buy_order: z.boolean().describe("Column public.structure_orders.is_buy_order – data/schema/combined-schema-reference.json#/tables/structureOrders"),
  price: z.string().describe("Column public.structure_orders.price – data/schema/combined-schema-reference.json#/tables/structureOrders"),
  volume_remain: z.number().int().describe("Column public.structure_orders.volume_remain – data/schema/combined-schema-reference.json#/tables/structureOrders"),
  issued_at: z.string().describe("Column public.structure_orders.issued_at – data/schema/combined-schema-reference.json#/tables/structureOrders"),
  last_updated_at: z.string().describe("Column public.structure_orders.last_updated_at – data/schema/combined-schema-reference.json#/tables/structureOrders"),
}).strict().describe("public.structure_orders (data/schema/combined-schema-reference.json#/tables/structureOrders)");

export const manifestSchemas = {
  item_prices_fact: ItemPricesFactRowSchema,
  market_history_refresh_cache: MarketHistoryRefreshCacheRowSchema,
  market_latest_stats: MarketLatestStatsRowSchema,
  market_price_history: MarketPriceHistoryRowSchema,
  sde_categories: SdeCategoriesRowSchema,
  sde_groups: SdeGroupsRowSchema,
  sde_market_groups: SdeMarketGroupsRowSchema,
  sde_master_materials: SdeMasterMaterialsRowSchema,
  sde_master_products: SdeMasterProductsRowSchema,
  sde_meta_groups: SdeMetaGroupsRowSchema,
  sde_types: SdeTypesRowSchema,
  structure_orders: StructureOrdersRowSchema
} as const;
