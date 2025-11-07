import type { Pool } from "pg";
import { mapTypeDetail } from "../../domain/items.js";
import type { ItemRepository, GetTypeDetailParams } from "../item-repository.js";
import { wrapRepositoryError } from "../errors.js";
import type { TypeDetail } from "../../domain/items.js";
import type {
  JsonValue,
  SdeCategoriesRow,
  SdeGroupsRow,
  SdeMarketGroupsRow,
  SdeMetaGroupsRow,
  SdeTypesRow
} from "../../generated/domain-types.js";

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

export class PostgresItemRepository implements ItemRepository {
  constructor(private readonly pool: Pool) {}

  async getTypeDetail(params: GetTypeDetailParams): Promise<TypeDetail | null> {
    const query = {
      name: "item:get-type-detail:v1",
      text: `
        SELECT
          t.key AS type_key,
          t.type_id AS type_type_id,
          t.name AS type_name,
          t.description AS type_description,
          t.published AS type_published,
          t.portion_size AS type_portion_size,
          t.base_price AS type_base_price,
          t.volume AS type_volume,
          t.mass AS type_mass,
          t.race_id AS type_race_id,
          t.faction_id AS type_faction_id,
          t.meta_group_id AS type_meta_group_id,
          t.market_group_id AS type_market_group_id,
          t.group_id AS type_group_id,
          g.key AS group_key,
          g.group_id AS group_group_id,
          g.category_id AS group_category_id,
          g.name AS group_name,
          g.published AS group_published,
          g.anchorable AS group_anchorable,
          g.anchored AS group_anchored,
          g.fittable_non_singleton AS group_fittable_non_singleton,
          g.use_base_price AS group_use_base_price,
          g.icon_id AS group_icon_id,
          c.key AS category_key,
          c.category_id AS category_category_id,
          c.name AS category_name,
          c.published AS category_published,
          c.icon_id AS category_icon_id,
          mg.key AS market_group_key,
          mg.market_group_id AS market_group_market_group_id,
          mg.name AS market_group_name,
          mg.description AS market_group_description,
          mg.parent_group_id AS market_group_parent_group_id,
          mg.has_types AS market_group_has_types,
          mg.icon_id AS market_group_icon_id,
          meta.key AS meta_group_key,
          meta.name AS meta_group_name,
          meta.description AS meta_group_description,
          meta.color AS meta_group_color,
          meta.icon_id AS meta_group_icon_id,
          meta.icon_suffix AS meta_group_icon_suffix,
          attr.value AS meta_level_value
        FROM sde_types t
        JOIN sde_groups g ON g.key = t.group_id
        JOIN sde_categories c ON c.key = g.category_id
        LEFT JOIN sde_market_groups mg ON mg.key = t.market_group_id
        LEFT JOIN sde_meta_groups meta ON meta.key = t.meta_group_id
        LEFT JOIN sde_dogma_type_attributes attr
               ON attr.type_id = t.type_id AND attr.attribute_id = 633
        WHERE t.type_id = $1
        LIMIT 1;
      `,
      values: [params.typeId],
    };

    try {
      const result = await this.pool.query(query);
      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const type: SdeTypesRow = {
        key: toNumber(row.type_key),
        type_id: toNullableNumber(row.type_type_id),
        name: row.type_name as Record<string, string>,
        description: row.type_description as string | null,
        portion_size: toNumber(row.type_portion_size),
        market_group_id: toNullableNumber(row.type_market_group_id),
        meta_group_id: toNullableNumber(row.type_meta_group_id),
        faction_id: toNullableNumber(row.type_faction_id),
        race_id: toNullableNumber(row.type_race_id),
        group_id: toNumber(row.type_group_id),
        volume: row.type_volume === null ? null : Number(row.type_volume),
        mass: row.type_mass === null ? null : Number(row.type_mass),
        base_price: row.type_base_price === null ? null : Number(row.type_base_price),
        published: Boolean(row.type_published),
      };

      const group: SdeGroupsRow = {
        key: toNumber(row.group_key),
        group_id: toNullableNumber(row.group_group_id),
        category_id: toNumber(row.group_category_id),
        anchorable: Boolean(row.group_anchorable),
        anchored: Boolean(row.group_anchored),
        fittable_non_singleton: Boolean(row.group_fittable_non_singleton),
        use_base_price: Boolean(row.group_use_base_price),
        icon_id: toNullableNumber(row.group_icon_id),
        name: row.group_name as Record<string, string>,
        published: Boolean(row.group_published),
      };

      const category: SdeCategoriesRow = {
        key: toNumber(row.category_key),
        category_id: toNullableNumber(row.category_category_id),
        icon_id: toNullableNumber(row.category_icon_id),
        name: row.category_name as Record<string, string>,
        published: Boolean(row.category_published),
      };

      const marketGroup: SdeMarketGroupsRow | null = row.market_group_key
        ? {
            key: toNumber(row.market_group_key),
            market_group_id: toNullableNumber(row.market_group_market_group_id),
            has_types: Boolean(row.market_group_has_types),
            name: row.market_group_name as Record<string, string>,
            description: row.market_group_description as string | null,
            icon_id: toNullableNumber(row.market_group_icon_id),
            parent_group_id: toNullableNumber(row.market_group_parent_group_id),
          }
        : null;

      const metaGroup: SdeMetaGroupsRow | null = row.meta_group_key
        ? {
            key: toNumber(row.meta_group_key),
            color: row.meta_group_color as JsonValue | null,
            description: row.meta_group_description as JsonValue | null,
            icon_id: toNullableNumber(row.meta_group_icon_id),
            icon_suffix: row.meta_group_icon_suffix as string | null,
            name: row.meta_group_name as Record<string, string>,
          }
        : null;

      return mapTypeDetail({
        type,
        group,
        category,
        marketGroup,
        metaGroup,
        metaLevelValue: toNullableNumber(row.meta_level_value),
      });
    } catch (error) {
      throw wrapRepositoryError("item:getTypeDetail", error);
    }
  }
}

export function createPostgresItemRepository(pool: Pool): ItemRepository {
  return new PostgresItemRepository(pool);
}
