import type { Pool } from "pg";
import { resolveCacheEnvelope, type CacheEnvelope, type CacheOptions } from "./shared.js";

export interface ItemDetailOptions {
  includeUnpublished?: boolean;
}

export interface ItemDetailRequestOptions extends ItemDetailOptions {
  cache?: CacheOptions;
}

export interface ItemBlueprintInfo {
  blueprintTypeId: number;
  blueprintName: string | null;
  activity: string;
  productQuantity: number | null;
  manufacturingTime: number | null;
  maxProductionLimit: number | null;
}

export interface ItemMaterialRow {
  materialTypeId: number;
  materialName: string | null;
  quantity: number;
  groupId: number | null;
  groupName: string | null;
}

export interface ItemDetail {
  typeId: number;
  name: string;
  description: string | null;
  published: boolean;
  groupId: number | null;
  groupName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  metaGroupId: number | null;
  metaGroupName: string | null;
  metaLevel: number | null;
  marketGroupKey: number | null;
  marketGroupId: number | null;
  marketGroupName: string | null;
  marketGroupPath: ItemMarketGroupPathNode[];
  factionId: number | null;
  factionName: string | null;
  raceId: number | null;
  mass: number | null;
  volume: number | null;
  basePrice: number | null;
  blueprint: ItemBlueprintInfo | null;
  materials: ItemMaterialRow[];
}

export interface ItemDetailResponse {
  data: ItemDetail | null;
  cache: CacheEnvelope;
}

export interface ItemMarketGroupPathNode {
  marketGroupKey: number;
  marketGroupId: number | null;
  name: string | null;
  parentGroupKey: number | null;
}

const DEFAULT_CACHE: CacheEnvelope = {
  scope: "public",
  maxAgeSeconds: 3600,
  staleWhileRevalidateSeconds: 120,
  generatedAt: new Date(0)
};

function buildNameExpression(alias: string): string {
  return `COALESCE(${alias}.name ->> 'en', ${alias}.name ->> 'en-us', ${alias}.name ->> 'de', ${alias}.name ->> 'fr', ${alias}.name ->> 'ja', ${alias}.name ->> 'ru', ${alias}.name ->> 'zh', ${alias}.name ->> 'es')`;
}

export async function getItemDetail(pool: Pool, typeId: number, options: ItemDetailRequestOptions = {}): Promise<ItemDetailResponse> {
  const { cache, includeUnpublished = false } = options;

  const metadataQuery = {
    name: "items:get-master-detail:v1",
    text: `
      SELECT
        mp.product_type_id,
        mp.product_name,
        st.description,
        st.published,
        mp.product_group_id,
        mp.product_group_name,
        mp.product_category_id,
        mp.product_category_name,
        mp.product_meta_group_id,
        mp.product_meta_group_name,
        mp.product_market_group_id,
        mp.product_market_group_name,
  market_path.market_group_path,
        mp.product_faction_id,
        mp.product_faction_name,
        st.race_id,
        st.mass,
        st.volume,
        st.base_price,
        mp.blueprint_type_id,
        mp.blueprint_name,
        mp.activity,
        mp.product_quantity,
        mp.manufacturing_time,
        mp.max_production_limit,
        attr.value AS meta_level
      FROM sde_master.master_products mp
      JOIN sde_master.sde_types st
        ON st.key = mp.product_type_id
      LEFT JOIN sde_master.sde_dogma_type_attributes attr
        ON attr.type_id = mp.product_type_id AND attr.attribute_id = 633
      LEFT JOIN LATERAL (
        WITH RECURSIVE mg AS (
          SELECT
            node.key,
            node.market_group_id,
            COALESCE(${buildNameExpression("node")}, mp.product_market_group_name) AS name,
            node.parent_group_id,
            0 AS depth
          FROM sde_master.sde_market_groups node
          WHERE node.key = mp.product_market_group_id
          UNION ALL
          SELECT
            parent.key,
            parent.market_group_id,
            COALESCE(${buildNameExpression("parent")}, mp.product_market_group_name) AS name,
            parent.parent_group_id,
            mg.depth + 1 AS depth
          FROM sde_master.sde_market_groups parent
          JOIN mg ON mg.parent_group_id = parent.key
        )
        SELECT jsonb_agg(
          jsonb_build_object(
            'marketGroupKey', mg.key,
            'marketGroupId', mg.market_group_id,
            'name', mg.name,
            'parentGroupKey', mg.parent_group_id
          )
          ORDER BY mg.depth DESC
        ) AS market_group_path
        FROM mg
      ) AS market_path ON TRUE
      WHERE mp.product_type_id = $1
      LIMIT 1;
    `,
    values: [typeId]
  } as const;

  const metadataResult = await pool.query(metadataQuery);
  const row = metadataResult.rows[0];

  if (!row) {
    return {
      data: null,
      cache: resolveCacheEnvelope(cache, DEFAULT_CACHE)
    };
  }

  const published = Boolean(row.published);
  if (!published && !includeUnpublished) {
    return {
      data: null,
      cache: resolveCacheEnvelope(cache, DEFAULT_CACHE)
    };
  }

  const materialsQuery = {
    name: "items:get-master-materials:v1",
    text: `
      SELECT
        material_type_id,
        material_name,
        quantity,
        material_group_id,
        material_group_name
      FROM sde_master.master_materials
      WHERE product_type_id = $1
        AND activity = 'manufacturing'
      ORDER BY material_name ASC;
    `,
    values: [typeId]
  } as const;

  const materialsResult = await pool.query(materialsQuery);

  const marketGroupPath: ItemMarketGroupPathNode[] = (() => {
    const rawPath = Array.isArray(row.market_group_path)
      ? (row.market_group_path as Array<Record<string, unknown>>)
      : [];

    const parsed = rawPath
      .map((entry) => {
        const keyValue = Number(entry.marketGroupKey);
        const node: ItemMarketGroupPathNode = {
          marketGroupKey: keyValue,
          marketGroupId:
            entry.marketGroupId === null || entry.marketGroupId === undefined
              ? null
              : Number(entry.marketGroupId),
          name: typeof entry.name === "string" ? entry.name : null,
          parentGroupKey:
            entry.parentGroupKey === null || entry.parentGroupKey === undefined
              ? null
              : Number(entry.parentGroupKey)
        };
        return node;
      })
      .filter((node) => Number.isFinite(node.marketGroupKey));

    if (parsed.length > 0) {
      return parsed;
    }

    if (row.product_market_group_id === null) {
      return [];
    }

    return [
      {
        marketGroupKey: Number(row.product_market_group_id),
        marketGroupId: row.product_market_group_id === null ? null : Number(row.product_market_group_id),
        name: row.product_market_group_name as string | null,
        parentGroupKey: null
      }
    ];
  })();

  const leafMarketGroup = marketGroupPath.at(-1) ?? null;
  const resolvedMarketGroupKey = leafMarketGroup
    ? leafMarketGroup.marketGroupKey
    : row.product_market_group_id === null
      ? null
      : Number(row.product_market_group_id);
  const resolvedMarketGroupId = leafMarketGroup && leafMarketGroup.marketGroupId !== null
    ? leafMarketGroup.marketGroupId
    : row.product_market_group_id === null
      ? null
      : Number(row.product_market_group_id);
  const resolvedMarketGroupName = leafMarketGroup?.name ?? (row.product_market_group_name as string | null);

  const data: ItemDetail = {
    typeId: Number(row.product_type_id),
    name: row.product_name as string,
    description: (row.description as string | null) ?? null,
    published,
    groupId: row.product_group_id === null ? null : Number(row.product_group_id),
    groupName: row.product_group_name as string | null,
    categoryId: row.product_category_id === null ? null : Number(row.product_category_id),
    categoryName: row.product_category_name as string | null,
    metaGroupId: row.product_meta_group_id === null ? null : Number(row.product_meta_group_id),
    metaGroupName: row.product_meta_group_name as string | null,
    metaLevel: row.meta_level === null || row.meta_level === undefined ? null : Number(row.meta_level),
    marketGroupKey: resolvedMarketGroupKey,
    marketGroupId: resolvedMarketGroupId,
    marketGroupName: resolvedMarketGroupName,
    marketGroupPath,
    factionId: row.product_faction_id === null ? null : Number(row.product_faction_id),
    factionName: row.product_faction_name as string | null,
    raceId: row.race_id === null ? null : Number(row.race_id),
    mass: row.mass === null ? null : Number(row.mass),
    volume: row.volume === null ? null : Number(row.volume),
    basePrice: row.base_price === null ? null : Number(row.base_price),
    blueprint: row.blueprint_type_id === null
      ? null
      : {
          blueprintTypeId: Number(row.blueprint_type_id),
          blueprintName: row.blueprint_name as string | null,
          activity: String(row.activity ?? "manufacturing"),
          productQuantity: row.product_quantity === null ? null : Number(row.product_quantity),
          manufacturingTime: row.manufacturing_time === null ? null : Number(row.manufacturing_time),
          maxProductionLimit: row.max_production_limit === null ? null : Number(row.max_production_limit)
        },
    materials: (materialsResult.rows as Array<{
      material_type_id: number | string;
      material_name: string | null;
      quantity: number | string;
      material_group_id: number | string | null;
      material_group_name: string | null;
    }>).map((material) => ({
      materialTypeId: Number(material.material_type_id),
      materialName: material.material_name as string | null,
      quantity: Number(material.quantity),
      groupId: material.material_group_id === null ? null : Number(material.material_group_id),
      groupName: material.material_group_name as string | null
    }))
  };

  return {
    data,
    cache: resolveCacheEnvelope(cache, DEFAULT_CACHE)
  };
}
