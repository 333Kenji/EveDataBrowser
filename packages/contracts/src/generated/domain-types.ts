// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from persistence/manifests/schema-manifest.json
// Schema hash: e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac
// Generated at: 2025-10-13T00:45:00Z

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

/**
 * Row projection for public.item_prices_fact.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/itemPricesFact
 */
export interface ItemPricesFactRow {
  /** Column public.item_prices_fact.type_id – data/schema/combined-schema-reference.json#/tables/itemPricesFact */
  readonly type_id: number;
  /** Column public.item_prices_fact.average – data/schema/combined-schema-reference.json#/tables/itemPricesFact */
  readonly average: string | null;
  /** Column public.item_prices_fact.adjusted – data/schema/combined-schema-reference.json#/tables/itemPricesFact */
  readonly adjusted: string | null;
  /** Column public.item_prices_fact.updated_at – data/schema/combined-schema-reference.json#/tables/itemPricesFact */
  readonly updated_at: string;
}
/**
 * Row projection for public.market_history_refresh_cache.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache
 */
export interface MarketHistoryRefreshCacheRow {
  /** Column public.market_history_refresh_cache.type_id – data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache */
  readonly type_id: number;
  /** Column public.market_history_refresh_cache.region_id – data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache */
  readonly region_id: number;
  /** Column public.market_history_refresh_cache.cached_until – data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache */
  readonly cached_until: string | null;
  /** Column public.market_history_refresh_cache.last_checked_at – data/schema/combined-schema-reference.json#/tables/marketHistoryRefreshCache */
  readonly last_checked_at: string | null;
}
/**
 * Row projection for public.market_latest_stats.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/marketLatestStats
 */
export interface MarketLatestStatsRow {
  /** Column public.market_latest_stats.type_id – data/schema/combined-schema-reference.json#/tables/marketLatestStats */
  readonly type_id: number;
  /** Column public.market_latest_stats.region_id – data/schema/combined-schema-reference.json#/tables/marketLatestStats */
  readonly region_id: number;
  /** Column public.market_latest_stats.last_seen_at – data/schema/combined-schema-reference.json#/tables/marketLatestStats */
  readonly last_seen_at: string;
  /** Column public.market_latest_stats.snapshot_low – data/schema/combined-schema-reference.json#/tables/marketLatestStats */
  readonly snapshot_low: number | null;
  /** Column public.market_latest_stats.snapshot_high – data/schema/combined-schema-reference.json#/tables/marketLatestStats */
  readonly snapshot_high: number | null;
  /** Column public.market_latest_stats.snapshot_median – data/schema/combined-schema-reference.json#/tables/marketLatestStats */
  readonly snapshot_median: number | null;
  /** Column public.market_latest_stats.snapshot_volume – data/schema/combined-schema-reference.json#/tables/marketLatestStats */
  readonly snapshot_volume: number | null;
  /** Column public.market_latest_stats.source – data/schema/combined-schema-reference.json#/tables/marketLatestStats */
  readonly source: string;
  /** Column public.market_latest_stats.updated_at – data/schema/combined-schema-reference.json#/tables/marketLatestStats */
  readonly updated_at: string;
}
/**
 * Row projection for public.market_price_history.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/marketPriceHistory
 */
export interface MarketPriceHistoryRow {
  /** Column public.market_price_history.type_id – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly type_id: number;
  /** Column public.market_price_history.region_id – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly region_id: number;
  /** Column public.market_price_history.ts_bucket_start – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly ts_bucket_start: string;
  /** Column public.market_price_history.average_price – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly average_price: number;
  /** Column public.market_price_history.high_price – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly high_price: number;
  /** Column public.market_price_history.low_price – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly low_price: number;
  /** Column public.market_price_history.median_price – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly median_price: number | null;
  /** Column public.market_price_history.volume – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly volume: number;
  /** Column public.market_price_history.order_count – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly order_count: number | null;
  /** Column public.market_price_history.source – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly source: string;
  /** Column public.market_price_history.last_ingested_at – data/schema/combined-schema-reference.json#/tables/marketPriceHistory */
  readonly last_ingested_at: string;
}
/**
 * Row projection for sde_master.sde_categories.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/categories
 */
export interface SdeCategoriesRow {
  /** Column sde_master.sde_categories.key – data/schema/combined-schema-reference.json#/tables/categories */
  readonly key: number;
  /** Column sde_master.sde_categories.category_id – data/schema/combined-schema-reference.json#/tables/categories */
  readonly category_id: number | null;
  /** Column sde_master.sde_categories.name – data/schema/combined-schema-reference.json#/tables/categories */
  readonly name: JsonValue;
  /** Column sde_master.sde_categories.published – data/schema/combined-schema-reference.json#/tables/categories */
  readonly published: boolean;
  /** Column sde_master.sde_categories.icon_id – data/schema/combined-schema-reference.json#/tables/categories */
  readonly icon_id: number | null;
}
/**
 * Row projection for sde_master.sde_groups.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/groups
 */
export interface SdeGroupsRow {
  /** Column sde_master.sde_groups.key – data/schema/combined-schema-reference.json#/tables/groups */
  readonly key: number;
  /** Column sde_master.sde_groups.group_id – data/schema/combined-schema-reference.json#/tables/groups */
  readonly group_id: number | null;
  /** Column sde_master.sde_groups.category_id – data/schema/combined-schema-reference.json#/tables/groups */
  readonly category_id: number | null;
  /** Column sde_master.sde_groups.name – data/schema/combined-schema-reference.json#/tables/groups */
  readonly name: JsonValue;
  /** Column sde_master.sde_groups.published – data/schema/combined-schema-reference.json#/tables/groups */
  readonly published: boolean;
  /** Column sde_master.sde_groups.anchorable – data/schema/combined-schema-reference.json#/tables/groups */
  readonly anchorable: boolean;
  /** Column sde_master.sde_groups.anchored – data/schema/combined-schema-reference.json#/tables/groups */
  readonly anchored: boolean;
  /** Column sde_master.sde_groups.fittable_non_singleton – data/schema/combined-schema-reference.json#/tables/groups */
  readonly fittable_non_singleton: boolean;
  /** Column sde_master.sde_groups.use_base_price – data/schema/combined-schema-reference.json#/tables/groups */
  readonly use_base_price: boolean;
  /** Column sde_master.sde_groups.icon_id – data/schema/combined-schema-reference.json#/tables/groups */
  readonly icon_id: number | null;
}
/**
 * Row projection for sde_master.sde_market_groups.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/marketGroups
 */
export interface SdeMarketGroupsRow {
  /** Column sde_master.sde_market_groups.key – data/schema/combined-schema-reference.json#/tables/marketGroups */
  readonly key: number;
  /** Column sde_master.sde_market_groups.market_group_id – data/schema/combined-schema-reference.json#/tables/marketGroups */
  readonly market_group_id: number | null;
  /** Column sde_master.sde_market_groups.name – data/schema/combined-schema-reference.json#/tables/marketGroups */
  readonly name: JsonValue;
  /** Column sde_master.sde_market_groups.description – data/schema/combined-schema-reference.json#/tables/marketGroups */
  readonly description: string | null;
  /** Column sde_master.sde_market_groups.parent_group_id – data/schema/combined-schema-reference.json#/tables/marketGroups */
  readonly parent_group_id: number | null;
  /** Column sde_master.sde_market_groups.has_types – data/schema/combined-schema-reference.json#/tables/marketGroups */
  readonly has_types: boolean;
  /** Column sde_master.sde_market_groups.icon_id – data/schema/combined-schema-reference.json#/tables/marketGroups */
  readonly icon_id: number | null;
}
/**
 * Row projection for sde_master.sde_master_materials.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/materials
 */
export interface SdeMasterMaterialsRow {
  /** Column sde_master.sde_master_materials.material_type_id – data/schema/combined-schema-reference.json#/tables/materials */
  readonly material_type_id: number;
  /** Column sde_master.sde_master_materials.product_type_id – data/schema/combined-schema-reference.json#/tables/materials */
  readonly product_type_id: number;
  /** Column sde_master.sde_master_materials.blueprint_type_id – data/schema/combined-schema-reference.json#/tables/materials */
  readonly blueprint_type_id: number;
  /** Column sde_master.sde_master_materials.activity – data/schema/combined-schema-reference.json#/tables/materials */
  readonly activity: string;
  /** Column sde_master.sde_master_materials.material_quantity – data/schema/combined-schema-reference.json#/tables/materials */
  readonly material_quantity: number;
  /** Column sde_master.sde_master_materials.created_at – data/schema/combined-schema-reference.json#/tables/materials */
  readonly created_at: string;
  /** Column sde_master.sde_master_materials.updated_at – data/schema/combined-schema-reference.json#/tables/materials */
  readonly updated_at: string;
}
/**
 * Row projection for sde_master.sde_master_products.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/products
 */
export interface SdeMasterProductsRow {
  /** Column sde_master.sde_master_products.product_type_id – data/schema/combined-schema-reference.json#/tables/products */
  readonly product_type_id: number;
  /** Column sde_master.sde_master_products.blueprint_type_id – data/schema/combined-schema-reference.json#/tables/products */
  readonly blueprint_type_id: number;
  /** Column sde_master.sde_master_products.activity – data/schema/combined-schema-reference.json#/tables/products */
  readonly activity: string;
  /** Column sde_master.sde_master_products.product_quantity – data/schema/combined-schema-reference.json#/tables/products */
  readonly product_quantity: number;
  /** Column sde_master.sde_master_products.manufacturing_time – data/schema/combined-schema-reference.json#/tables/products */
  readonly manufacturing_time: number;
  /** Column sde_master.sde_master_products.max_production_limit – data/schema/combined-schema-reference.json#/tables/products */
  readonly max_production_limit: number | null;
  /** Column sde_master.sde_master_products.created_at – data/schema/combined-schema-reference.json#/tables/products */
  readonly created_at: string;
  /** Column sde_master.sde_master_products.updated_at – data/schema/combined-schema-reference.json#/tables/products */
  readonly updated_at: string;
}
/**
 * Row projection for sde_master.sde_meta_groups.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/metaGroups
 */
export interface SdeMetaGroupsRow {
  /** Column sde_master.sde_meta_groups.key – data/schema/combined-schema-reference.json#/tables/metaGroups */
  readonly key: number;
  /** Column sde_master.sde_meta_groups.name – data/schema/combined-schema-reference.json#/tables/metaGroups */
  readonly name: JsonValue;
  /** Column sde_master.sde_meta_groups.description – data/schema/combined-schema-reference.json#/tables/metaGroups */
  readonly description: JsonValue | null;
  /** Column sde_master.sde_meta_groups.color – data/schema/combined-schema-reference.json#/tables/metaGroups */
  readonly color: JsonValue | null;
  /** Column sde_master.sde_meta_groups.icon_suffix – data/schema/combined-schema-reference.json#/tables/metaGroups */
  readonly icon_suffix: string | null;
  /** Column sde_master.sde_meta_groups.icon_id – data/schema/combined-schema-reference.json#/tables/metaGroups */
  readonly icon_id: number | null;
}
/**
 * Row projection for sde_master.sde_types.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/types
 */
export interface SdeTypesRow {
  /** Column sde_master.sde_types.key – data/schema/combined-schema-reference.json#/tables/types */
  readonly key: number;
  /** Column sde_master.sde_types.type_id – data/schema/combined-schema-reference.json#/tables/types */
  readonly type_id: number | null;
  /** Column sde_master.sde_types.group_id – data/schema/combined-schema-reference.json#/tables/types */
  readonly group_id: number;
  /** Column sde_master.sde_types.name – data/schema/combined-schema-reference.json#/tables/types */
  readonly name: JsonValue;
  /** Column sde_master.sde_types.description – data/schema/combined-schema-reference.json#/tables/types */
  readonly description: string | null;
  /** Column sde_master.sde_types.published – data/schema/combined-schema-reference.json#/tables/types */
  readonly published: boolean;
  /** Column sde_master.sde_types.portion_size – data/schema/combined-schema-reference.json#/tables/types */
  readonly portion_size: number;
  /** Column sde_master.sde_types.base_price – data/schema/combined-schema-reference.json#/tables/types */
  readonly base_price: number | null;
  /** Column sde_master.sde_types.volume – data/schema/combined-schema-reference.json#/tables/types */
  readonly volume: number | null;
  /** Column sde_master.sde_types.mass – data/schema/combined-schema-reference.json#/tables/types */
  readonly mass: number | null;
  /** Column sde_master.sde_types.race_id – data/schema/combined-schema-reference.json#/tables/types */
  readonly race_id: number | null;
  /** Column sde_master.sde_types.faction_id – data/schema/combined-schema-reference.json#/tables/types */
  readonly faction_id: number | null;
  /** Column sde_master.sde_types.market_group_id – data/schema/combined-schema-reference.json#/tables/types */
  readonly market_group_id: number | null;
  /** Column sde_master.sde_types.meta_group_id – data/schema/combined-schema-reference.json#/tables/types */
  readonly meta_group_id: number | null;
}
/**
 * Row projection for public.structure_orders.
 * Source schema path: data/schema/combined-schema-reference.json#/tables/structureOrders
 */
export interface StructureOrdersRow {
  /** Column public.structure_orders.structure_id – data/schema/combined-schema-reference.json#/tables/structureOrders */
  readonly structure_id: number;
  /** Column public.structure_orders.order_id – data/schema/combined-schema-reference.json#/tables/structureOrders */
  readonly order_id: number;
  /** Column public.structure_orders.type_id – data/schema/combined-schema-reference.json#/tables/structureOrders */
  readonly type_id: number;
  /** Column public.structure_orders.is_buy_order – data/schema/combined-schema-reference.json#/tables/structureOrders */
  readonly is_buy_order: boolean;
  /** Column public.structure_orders.price – data/schema/combined-schema-reference.json#/tables/structureOrders */
  readonly price: string;
  /** Column public.structure_orders.volume_remain – data/schema/combined-schema-reference.json#/tables/structureOrders */
  readonly volume_remain: number;
  /** Column public.structure_orders.issued_at – data/schema/combined-schema-reference.json#/tables/structureOrders */
  readonly issued_at: string;
  /** Column public.structure_orders.last_updated_at – data/schema/combined-schema-reference.json#/tables/structureOrders */
  readonly last_updated_at: string;
}
