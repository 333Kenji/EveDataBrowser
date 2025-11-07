import type { Pool } from "pg";
import type { MarketRepository, MarketHistoryQuery, MarketLatestStatsQuery } from "../market-repository.js";
import { wrapRepositoryError } from "../errors.js";
import { mapHistoryRow, mapLatestStatsRow } from "../../domain/market.js";
import { MARKET_HISTORY_DEFAULT_LIMIT } from "../../config/market-history.js";

export class PostgresMarketRepository implements MarketRepository {
  constructor(private readonly pool: Pool) {}

  async getHistory(query: MarketHistoryQuery) {
    const { typeId, regionId, startDate, endDate, order = "desc" } = query;
    const limit = query.limit ?? MARKET_HISTORY_DEFAULT_LIMIT;

    const conditions: string[] = ["type_id = $1", "region_id = $2"];
    const values: unknown[] = [typeId, regionId];

    if (startDate) {
      conditions.push(`ts_bucket_start >= $${values.length + 1}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`ts_bucket_start <= $${values.length + 1}`);
      values.push(endDate);
    }

    values.push(Math.max(1, limit));
    const limitIndex = values.length;

    const sql = {
      name: "market:get-history:v1",
      text: `
        SELECT type_id, region_id, ts_bucket_start, average_price, high_price, low_price, median_price, volume, order_count, source, last_ingested_at
        FROM market_price_history
        WHERE ${conditions.join(" AND ")}
        ORDER BY ts_bucket_start ${order === "asc" ? "ASC" : "DESC"}
        LIMIT $${limitIndex};
      `,
      values,
    };

    try {
      const result = await this.pool.query(sql);
      return result.rows.map(mapHistoryRow);
    } catch (error) {
      throw wrapRepositoryError("market:getHistory", error);
    }
  }

  async getLatestStats(query: MarketLatestStatsQuery) {
    const sql = {
      name: "market:get-latest-stats:v1",
      text: `
        SELECT type_id, region_id, last_seen_at, snapshot_low, snapshot_high, snapshot_median, snapshot_volume, source, updated_at
        FROM market_latest_stats
        WHERE type_id = $1 AND region_id = $2
        LIMIT 1;
      `,
      values: [query.typeId, query.regionId],
    };

    try {
      const result = await this.pool.query(sql);
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      return mapLatestStatsRow(row);
    } catch (error) {
      throw wrapRepositoryError("market:getLatestStats", error);
    }
  }
}

export function createPostgresMarketRepository(pool: Pool): MarketRepository {
  return new PostgresMarketRepository(pool);
}
