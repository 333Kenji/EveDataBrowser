import type { Pool } from "pg";
import { resolveCacheEnvelope, type CacheEnvelope, type CacheOptions } from "./shared.js";

export interface TaxonomySearchParams {
  query?: string;
  limit?: number;
  offset?: number;
  groupIds?: number[];
  categoryIds?: number[];
  metaGroupIds?: number[];
  publishedOnly?: boolean;
}

export interface TaxonomyItemSummary {
  typeId: number;
  name: string;
  groupId: number | null;
  groupName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  metaGroupId: number | null;
  metaGroupName: string | null;
  marketGroupKey: number | null;
  marketGroupId: number | null;
  marketGroupName: string | null;
  marketGroupPath: TaxonomyMarketGroupPathNode[];
  isBlueprintManufactured: boolean;
  published: boolean;
}

export interface TaxonomyMarketGroupPathNode {
  marketGroupKey: number;
  marketGroupId: number | null;
  name: string | null;
  parentGroupKey: number | null;
}

export interface TaxonomySearchResult {
  items: TaxonomyItemSummary[];
  limit: number;
  offset: number;
  total: number;
}

export interface TaxonomySearchResponse {
  data: TaxonomySearchResult;
  cache: CacheEnvelope;
}

export interface TaxonomySearchOptions extends TaxonomySearchParams {
  cache?: CacheOptions;
}

const MAX_SEARCH_LIMIT = 20000;
const DEFAULT_CACHE: CacheEnvelope = {
  scope: "public",
  maxAgeSeconds: 3600,
  staleWhileRevalidateSeconds: 120,
  generatedAt: new Date(0)
};

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || limit === undefined || limit === null) {
    return 25;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_LIMIT);
}

function clampOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset) || offset === undefined || offset === null) {
    return 0;
  }
  return Math.max(Math.trunc(offset), 0);
}

function buildNameExpression(alias: string): string {
  return `COALESCE(${alias}.name ->> 'en', ${alias}.name ->> 'en-us', ${alias}.name ->> 'de', ${alias}.name ->> 'fr', ${alias}.name ->> 'ja', ${alias}.name ->> 'ru', ${alias}.name ->> 'zh', ${alias}.name ->> 'es')`;
}

export async function searchTaxonomy(pool: Pool, options: TaxonomySearchOptions = {}): Promise<TaxonomySearchResponse> {
  const { cache, ...params } = options;
  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);
  const conditions: string[] = [];
  const values: unknown[] = [];

  if ((params.publishedOnly ?? true) === true) {
    conditions.push("st.published = TRUE");
  }

  if (params.query && params.query.trim()) {
    values.push(`%${params.query.trim().toLowerCase()}%`);
    conditions.push(`LOWER(mp.product_name) LIKE $${values.length}`);
  }

  if (params.groupIds && params.groupIds.length > 0) {
    values.push(params.groupIds);
    conditions.push(`mp.product_group_id = ANY($${values.length}::bigint[])`);
  }

  if (params.categoryIds && params.categoryIds.length > 0) {
    values.push(params.categoryIds);
    conditions.push(`mp.product_category_id = ANY($${values.length}::bigint[])`);
  }

  if (params.metaGroupIds && params.metaGroupIds.length > 0) {
    values.push(params.metaGroupIds);
    conditions.push(`mp.product_meta_group_id = ANY($${values.length}::bigint[])`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const groupName = buildNameExpression("sg");
  const categoryName = buildNameExpression("sc");
  const metaGroupName = buildNameExpression("smmg");

  const itemsQuery = {
    name: "taxonomy:search-master:v1",
    text: `
      SELECT
        mp.product_type_id AS type_id,
        mp.product_name AS product_name,
        mp.product_group_id,
        COALESCE(mp.product_group_name, ${groupName}) AS group_name,
        mp.product_category_id,
        COALESCE(mp.product_category_name, ${categoryName}) AS category_name,
        mp.product_meta_group_id,
        COALESCE(mp.product_meta_group_name, ${metaGroupName}) AS meta_group_name,
        mp.product_market_group_id,
        mp.product_market_group_name,
        market_path.market_group_path,
        st.published,
        (mp.activity = 'manufacturing') AS is_blueprint_manufactured
      FROM sde_master.master_products mp
      JOIN sde_master.sde_types st
        ON st.key = mp.product_type_id
      LEFT JOIN sde_master.sde_groups sg
        ON sg.key = mp.product_group_id
      LEFT JOIN sde_master.sde_categories sc
        ON sc.key = COALESCE(mp.product_category_id, sg.category_id)
      LEFT JOIN sde_master.sde_meta_groups smmg
        ON smmg.key = COALESCE(mp.product_meta_group_id, st.meta_group_id)
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
      ${whereClause}
      ORDER BY mp.product_name ASC, mp.product_type_id ASC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex};
    `,
    values: [...values, limit, offset]
  };

  const countQuery = {
    name: "taxonomy:search-master-count:v1",
    text: `
      SELECT COUNT(*)::bigint AS total
      FROM sde_master.master_products mp
      JOIN sde_master.sde_types st
        ON st.key = mp.product_type_id
      LEFT JOIN sde_master.sde_groups sg
        ON sg.key = mp.product_group_id
      LEFT JOIN sde_master.sde_categories sc
        ON sc.key = COALESCE(mp.product_category_id, sg.category_id)
      LEFT JOIN sde_master.sde_meta_groups smmg
        ON smmg.key = COALESCE(mp.product_meta_group_id, st.meta_group_id)
      ${whereClause};
    `,
    values
  };

  const [itemsResult, countResult] = await Promise.all([
    pool.query(itemsQuery as any),
    pool.query(countQuery as any)
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);

  const data: TaxonomySearchResult = {
    items: (itemsResult.rows as Array<{
      type_id: number | string;
      product_name: string;
      product_group_id: number | string | null;
      group_name: string | null;
      product_category_id: number | string | null;
      category_name: string | null;
      product_meta_group_id: number | string | null;
      meta_group_name: string | null;
      market_group_path: unknown;
      product_market_group_id: number | string | null;
      product_market_group_name: string | null;
      is_blueprint_manufactured: unknown;
      published: unknown;
    }>).map((row) => {
      const rawPath = Array.isArray(row.market_group_path)
        ? (row.market_group_path as Array<Record<string, unknown>>)
        : [];

      const marketGroupPath: TaxonomyMarketGroupPathNode[] = rawPath
        .map((entry) => {
          const keyValue = Number(entry.marketGroupKey);
          const node: TaxonomyMarketGroupPathNode = {
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

      const leafMarketGroup = marketGroupPath.at(-1) ?? null;
      const fallbackMarketGroupKey =
        row.product_market_group_id === null ? null : Number(row.product_market_group_id);

      return {
        typeId: Number(row.type_id),
        name: row.product_name as string,
        groupId: row.product_group_id === null ? null : Number(row.product_group_id),
        groupName: row.group_name as string | null,
        categoryId: row.product_category_id === null ? null : Number(row.product_category_id),
        categoryName: row.category_name as string | null,
        metaGroupId: row.product_meta_group_id === null ? null : Number(row.product_meta_group_id),
        metaGroupName: row.meta_group_name as string | null,
        marketGroupPath,
        marketGroupKey: leafMarketGroup ? leafMarketGroup.marketGroupKey : fallbackMarketGroupKey,
        marketGroupId:
          row.product_market_group_id === null ? null : Number(row.product_market_group_id),
        marketGroupName: row.product_market_group_name as string | null,
        isBlueprintManufactured: Boolean(row.is_blueprint_manufactured),
        published: Boolean(row.published)
      } satisfies TaxonomyItemSummary;
    }),
    limit,
    offset,
    total
  };

  return {
    data,
    cache: resolveCacheEnvelope(cache, DEFAULT_CACHE)
  };
}
