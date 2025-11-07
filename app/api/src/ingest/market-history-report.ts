import { Pool } from "pg";

export interface MarketHistoryReportOptions {
  regionId: number;
  staleAfterDays: number;
  limit?: number | null;
  now?: Date;
}

export interface MarketHistoryReportItem {
  typeId: number;
  regionId: number;
  marketGroupId: number | null;
  name: string | null;
  lastBucket: string | null;
}

export interface MarketHistoryReportSummary {
  regionId: number;
  staleAfterDays: number;
  cutoffIso: string;
  stale: MarketHistoryReportItem[];
  missing: MarketHistoryReportItem[];
  freshCount: number;
  totalConsidered: number;
}

const DEFAULT_OPTIONS: MarketHistoryReportOptions = {
  regionId: 10000002,
  staleAfterDays: 7,
  limit: null,
  now: undefined,
};

function parseEnglishName(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const maybeEn = (raw as Record<string, unknown>)["en"]; // JSONB -> JS object after pg driver parsing
  return typeof maybeEn === "string" && maybeEn.trim().length > 0 ? maybeEn : null;
}

export async function generateMarketHistoryReport(
  pool: Pool,
  options: MarketHistoryReportOptions,
): Promise<MarketHistoryReportSummary> {
  const { regionId, staleAfterDays, limit = null } = { ...DEFAULT_OPTIONS, ...options };
  if (!Number.isFinite(regionId) || regionId <= 0) {
    throw new Error(`Invalid regionId: ${regionId}`);
  }
  if (!Number.isFinite(staleAfterDays) || staleAfterDays <= 0) {
    throw new Error(`Invalid staleAfterDays: ${staleAfterDays}`);
  }
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - staleAfterDays * 24 * 60 * 60 * 1000);

  const sql = `
    WITH latest_history AS (
      SELECT type_id, MAX(ts_bucket_start) AS last_bucket
      FROM market_price_history
      WHERE region_id = $1
      GROUP BY type_id
    )
    SELECT
      t.type_id,
      $1::bigint AS region_id,
      t.market_group_id,
      t.name,
      lh.last_bucket
    FROM sde_master.sde_types t
    LEFT JOIN latest_history lh ON lh.type_id = t.type_id
    WHERE t.published = true AND t.market_group_id IS NOT NULL
    ORDER BY t.type_id;
  `;

  const result = await pool.query(sql, [regionId]);

  const stale: MarketHistoryReportItem[] = [];
  const missing: MarketHistoryReportItem[] = [];
  let freshCount = 0;

  for (const row of result.rows) {
    const lastBucket = row.last_bucket ? new Date(row.last_bucket) : null;
    if (!lastBucket) {
      missing.push({
        typeId: Number(row.type_id),
        regionId,
        marketGroupId: row.market_group_id !== null ? Number(row.market_group_id) : null,
        name: parseEnglishName(row.name),
        lastBucket: null,
      });
      continue;
    }

    const lastBucketIso = lastBucket.toISOString();
    if (lastBucket < cutoff) {
      stale.push({
        typeId: Number(row.type_id),
        regionId,
        marketGroupId: row.market_group_id !== null ? Number(row.market_group_id) : null,
        name: parseEnglishName(row.name),
        lastBucket: lastBucketIso,
      });
    } else {
      freshCount += 1;
    }
  }

  const limitValue = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? limit : null;
  const limitedStale = limitValue ? stale.slice(0, limitValue) : stale;
  const remainingLimit = limitValue ? Math.max(limitValue - limitedStale.length, 0) : null;
  const limitedMissing = remainingLimit !== null ? missing.slice(0, remainingLimit) : missing;

  return {
    regionId,
    staleAfterDays,
    cutoffIso: cutoff.toISOString(),
    stale: limitedStale,
    missing: limitedMissing,
    freshCount,
    totalConsidered: result.rowCount,
  };
}