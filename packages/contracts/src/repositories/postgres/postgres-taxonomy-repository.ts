import type { Pool } from "pg";
import type {
  TaxonomyHierarchyOptions,
  TaxonomyRepository,
  TaxonomySearchOptions,
  TaxonomySearchFilters
} from "../taxonomy-repository.js";
import type { TaxonomyCategoryNode, TaxonomyGroupNode, TaxonomyTypeSummary } from "../../domain/taxonomy.js";
import { validateWithSchema } from "../../validation/runtime.js";
import { TaxonomyCategoryNodeSchema, TaxonomyTypeSummarySchema, TaxonomyMarketGroupNodeSchema } from "../../validation/domain.js";
import { wrapRepositoryError } from "../errors.js";

function toNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric value, received ${value}`);
  }
  return parsed;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return toNumber(value);
}

function buildTypeConditions(filters: TaxonomySearchFilters | undefined, values: unknown[]): string[] {
  const conditions: string[] = ["t.type_id IS NOT NULL"];
  const ensurePublished = filters?.publishedOnly ?? true;

  if (ensurePublished) {
    conditions.push("t.published = TRUE");
    conditions.push("g.published = TRUE");
    conditions.push("c.published = TRUE");
  }

  if (filters?.categoryIds && filters.categoryIds.length > 0) {
    values.push(filters.categoryIds);
    conditions.push(`c.category_id = ANY($${values.length})`);
  }

  if (filters?.groupIds && filters.groupIds.length > 0) {
    values.push(filters.groupIds);
    conditions.push(`g.group_id = ANY($${values.length})`);
  }

  if (filters?.metaGroupIds && filters.metaGroupIds.length > 0) {
    values.push(filters.metaGroupIds);
    conditions.push(`t.meta_group_id = ANY($${values.length})`);
  }

  return conditions;
}

export class PostgresTaxonomyRepository implements TaxonomyRepository {
  constructor(private readonly pool: Pool) {}

  async listHierarchy(options: TaxonomyHierarchyOptions = {}): Promise<ReadonlyArray<TaxonomyCategoryNode>> {
    const includeUnpublished = options.includeUnpublished ?? false;
    const minimumTypeCount = options.minimumTypeCount ?? 0;

    const where: string[] = ["1=1"];
    if (!includeUnpublished) {
      where.push("c.published = TRUE");
      where.push("g.published = TRUE");
    }

    const query = {
      name: "taxonomy:list-hierarchy:v1",
      text: `
        WITH type_counts AS (
          SELECT group_id, COUNT(*)::bigint AS type_count
          FROM sde_types
          WHERE type_id IS NOT NULL AND published = TRUE
          GROUP BY group_id
        )
        SELECT
          c.key AS category_key,
          c.category_id AS category_category_id,
          c.name AS category_name,
          c.published AS category_published,
          g.key AS group_key,
          g.group_id AS group_group_id,
          g.category_id AS group_category_id,
          g.name AS group_name,
          g.published AS group_published,
          COALESCE(tc.type_count, 0) AS type_count
        FROM sde_categories c
        JOIN sde_groups g ON g.category_id = c.key
        LEFT JOIN type_counts tc ON tc.group_id = g.key
        WHERE ${where.join(" AND ")}
        ORDER BY COALESCE(c.category_id, c.key), COALESCE(g.group_id, g.key);
      `,
      values: [] as unknown[],
    };

    try {
      const result = await this.pool.query(query);
      const categories = new Map<number, { category: TaxonomyCategoryNode; groups: TaxonomyGroupNode[] }>();

      for (const row of result.rows) {
        const categoryKey = toNumber(row.category_key);
        const categoryId = toNullableNumber(row.category_category_id);
        const categoryName = row.category_name as Record<string, string>;
        const categoryPublished = Boolean(row.category_published);
        const typeCount = toNumber(row.type_count);

        if (minimumTypeCount > 0 && typeCount < minimumTypeCount) {
          continue;
        }

        let entry = categories.get(categoryKey);
        if (!entry) {
          entry = {
            category: {
              categoryKey,
              categoryId,
              name: categoryName,
              published: categoryPublished,
              groups: [],
            },
            groups: [],
          };
          categories.set(categoryKey, entry);
        }

        const groupKey = toNumber(row.group_key);
        const groupId = toNullableNumber(row.group_group_id);
        const groupName = row.group_name as Record<string, string>;
        const groupPublished = Boolean(row.group_published);

        const groupNode: TaxonomyGroupNode = {
          groupKey,
          groupId,
          categoryKey,
          categoryId,
          name: groupName,
          published: groupPublished,
          typeCount,
        };

        entry.groups.push(groupNode);
      }

      const nodes = Array.from(categories.values())
        .map(({ category, groups }) => ({
          ...category,
          groups: groups
            .sort((a, b) => (a.groupId ?? a.groupKey) - (b.groupId ?? b.groupKey))
            .map((group) => ({ ...group }))
        }))
        .filter((category) => category.groups.length > 0 || minimumTypeCount === 0)
        .sort((a, b) => (a.categoryId ?? a.categoryKey) - (b.categoryId ?? b.categoryKey));

  return nodes.map((node) => validateWithSchema(TaxonomyCategoryNodeSchema, node, "taxonomy category node"));
    } catch (error) {
      throw wrapRepositoryError("taxonomy:listHierarchy", error);
    }
  }

  async searchTypes(options: TaxonomySearchOptions): Promise<ReadonlyArray<TaxonomyTypeSummary>> {
    const { query: searchTerm, limit = 20, offset = 0, filters } = options;
    const values: unknown[] = [];
    const conditions = buildTypeConditions(filters, values);

    if (searchTerm && searchTerm.trim()) {
      values.push(`%${searchTerm.trim().toLowerCase()}%`);
      conditions.push(`LOWER(t.name ->> 'en') LIKE $${values.length}`);
    }

    values.push(Math.max(1, limit));
    const limitIndex = values.length;
    values.push(Math.max(0, offset));
    const offsetIndex = values.length;

    const queryConfig = {
      name: "taxonomy:search-types:v2",
      text: `
        WITH search AS (
          SELECT
            t.key AS type_key,
            t.type_id AS type_type_id,
            t.name AS type_name,
            t.market_group_id AS type_market_group_id,
            t.meta_group_id AS type_meta_group_id,
            t.faction_id AS type_faction_id,
            t.published AS type_published,
            g.key AS group_key,
            g.group_id AS group_group_id,
            g.category_id AS group_category_id,
            g.name AS group_name,
            c.key AS category_key,
            c.category_id AS category_category_id,
            c.name AS category_name
          FROM sde_types t
          JOIN sde_groups g ON g.key = t.group_id
          JOIN sde_categories c ON c.key = g.category_id
          WHERE ${conditions.join(" AND ")}
          ORDER BY LOWER(t.name ->> 'en'), COALESCE(t.type_id, t.key)
          LIMIT $${limitIndex}
          OFFSET $${offsetIndex}
        )
        SELECT
          search.*,
          COALESCE(path.market_group_path, '[]'::jsonb) AS market_group_path,
          COALESCE(blueprint.has_manufacturing, FALSE) AS has_manufacturing
        FROM search
        LEFT JOIN LATERAL (
          WITH RECURSIVE mg AS (
            SELECT
              mg.key,
              mg.market_group_id,
              mg.name,
              mg.parent_group_id,
              0 AS depth
            FROM sde_market_groups mg
            WHERE mg.key = search.type_market_group_id
            UNION ALL
            SELECT
              parent.key,
              parent.market_group_id,
              parent.name,
              parent.parent_group_id,
              mg.depth + 1
            FROM sde_market_groups parent
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
        ) AS path ON TRUE
        LEFT JOIN LATERAL (
          SELECT TRUE AS has_manufacturing
          FROM sde_blueprints bp
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bp.activities -> 'manufacturing' -> 'products', '[]'::jsonb)) AS product(entry)
          WHERE search.type_type_id IS NOT NULL
            AND (product.entry ->> 'typeID')::bigint = search.type_type_id::bigint
          LIMIT 1
        ) AS blueprint ON TRUE;
      `,
      values,
    };

    try {
      const result = await this.pool.query(queryConfig);
      return result.rows.map((row) => {
        const categoryKey = toNumber(row.category_key);
        const categoryId = toNullableNumber(row.category_category_id);
        const groupKey = toNumber(row.group_key);
        const groupId = toNullableNumber(row.group_group_id);
        const typeKey = toNumber(row.type_key);
        const typeId = toNullableNumber(row.type_type_id);

        const marketGroupPathRaw = row.market_group_path as unknown;
        const marketGroupPath: TaxonomyTypeSummary["marketGroupPath"] = Array.isArray(marketGroupPathRaw)
          ? marketGroupPathRaw.map((entry) => {
              const record = entry as Record<string, unknown>;
              const node = {
                marketGroupKey: toNumber(record.marketGroupKey),
                marketGroupId: toNullableNumber(record.marketGroupId ?? null),
                name: record.name as Record<string, string>,
                parentGroupKey: toNullableNumber(record.parentGroupKey ?? null),
              };
              return validateWithSchema(TaxonomyMarketGroupNodeSchema, node, "taxonomy market group node");
            })
          : [];

        const summary: TaxonomyTypeSummary = {
          typeKey,
          typeId,
          name: row.type_name as Record<string, string>,
          published: Boolean(row.type_published),
          isBlueprintManufactured: Boolean(row.has_manufacturing),
          group: {
            groupKey,
            groupId,
            name: row.group_name as Record<string, string>,
            categoryKey,
            categoryId,
          },
          category: {
            categoryKey,
            categoryId,
            name: row.category_name as Record<string, string>,
          },
          metaGroupKey: toNullableNumber(row.type_meta_group_id),
          metaGroupId: null,
          marketGroupKey: toNullableNumber(row.type_market_group_id),
          marketGroupPath,
          factionId: toNullableNumber(row.type_faction_id),
        };

        return validateWithSchema(TaxonomyTypeSummarySchema, summary, "taxonomy type summary");
      });
    } catch (error) {
      throw wrapRepositoryError("taxonomy:searchTypes", error);
    }
  }
}

export function createPostgresTaxonomyRepository(pool: Pool): TaxonomyRepository {
  return new PostgresTaxonomyRepository(pool);
}
