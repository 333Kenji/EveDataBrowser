import { Pool } from "pg";

export interface MarketHistoryBucket {
  date: string;
  average: number;
  highest: number;
  lowest: number;
  volume: number;
  orderCount?: number | null;
  median?: number | null;
}

export interface AppendMarketHistoryOptions {
  now?: Date;
  source?: string;
}

export interface AppendMarketHistoryResult {
  insertedCount: number;
  skippedCount: number;
  latestBucketTimestamp: Date | null;
}

const DEFAULT_SOURCE = "esi";

const CHECK_HISTORY_SQL = `
  SELECT 1
  FROM market_price_history
  WHERE type_id = $1 AND region_id = $2 AND ts_bucket_start = $3
  LIMIT 1;
`;

const INSERT_HISTORY_SQL = `
  INSERT INTO market_price_history (
    type_id,
    region_id,
    ts_bucket_start,
    average_price,
    high_price,
    low_price,
    median_price,
    volume,
    order_count,
    source,
    last_ingested_at
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11
  )
  ON CONFLICT (type_id, region_id, ts_bucket_start)
  DO NOTHING;
`;

const UPSERT_LATEST_SQL = `
  INSERT INTO market_latest_stats (
    type_id,
    region_id,
    last_seen_at,
    snapshot_low,
    snapshot_high,
    snapshot_median,
    snapshot_volume,
    source,
    updated_at
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
  )
  ON CONFLICT (type_id, region_id)
  DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at,
        snapshot_low = EXCLUDED.snapshot_low,
        snapshot_high = EXCLUDED.snapshot_high,
        snapshot_median = EXCLUDED.snapshot_median,
        snapshot_volume = EXCLUDED.snapshot_volume,
        source = EXCLUDED.source,
        updated_at = EXCLUDED.updated_at
  WHERE market_latest_stats.last_seen_at < EXCLUDED.last_seen_at;
`;

function toBucketTimestamp(date: string): Date {
  const isoCandidate = `${date}T00:00:00Z`;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid market history date: ${date}`);
  }
  return parsed;
}

export async function appendMarketHistory(
  pool: Pool,
  typeId: number,
  regionId: number,
  buckets: MarketHistoryBucket[],
  options: AppendMarketHistoryOptions = {}
): Promise<AppendMarketHistoryResult> {
  if (!Number.isFinite(typeId) || !Number.isFinite(regionId)) {
    throw new Error("appendMarketHistory requires numeric typeId and regionId");
  }

  const now = options.now ?? new Date();
  const source = options.source ?? DEFAULT_SOURCE;
  if (!Array.isArray(buckets) || buckets.length === 0) {
    return { insertedCount: 0, skippedCount: 0, latestBucketTimestamp: null };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let insertedCount = 0;
    let skippedCount = 0;
    let latestBucketTimestamp: Date | null = null;
    let latestInsertedBucket: MarketHistoryBucket | null = null;

    for (const bucket of buckets) {
      if (!Number.isFinite(bucket.average)) {
        throw new Error(`Invalid average price for type ${typeId} on ${bucket.date}`);
      }
      if (!Number.isFinite(bucket.highest) || !Number.isFinite(bucket.lowest)) {
        throw new Error(`Invalid price bounds for type ${typeId} on ${bucket.date}`);
      }
      if (!Number.isFinite(bucket.volume)) {
        throw new Error(`Invalid volume for type ${typeId} on ${bucket.date}`);
      }
      const orderCountValue = bucket.orderCount ?? null;
      if (orderCountValue !== null && !Number.isFinite(orderCountValue)) {
        throw new Error(`Invalid order count for type ${typeId} on ${bucket.date}`);
      }
      const medianValue = bucket.median ?? null;
      if (medianValue !== null && !Number.isFinite(medianValue)) {
        throw new Error(`Invalid median price for type ${typeId} on ${bucket.date}`);
      }

      const bucketTimestamp = toBucketTimestamp(bucket.date);
      const timestampIso = bucketTimestamp.toISOString();
      const existsResult = await client.query(CHECK_HISTORY_SQL, [
        typeId,
        regionId,
        timestampIso
      ]);

      if (existsResult.rowCount > 0) {
        skippedCount += 1;
        continue;
      }

      const values = [
        typeId,
        regionId,
        timestampIso,
        bucket.average,
        bucket.highest,
        bucket.lowest,
        medianValue,
        bucket.volume,
        orderCountValue,
        source,
        now.toISOString()
      ];

      const result = await client.query(INSERT_HISTORY_SQL, values);
      if (result.rowCount !== 1) {
        // The unique constraint acts as the final guard; treat non-insert anomalies as skips.
        skippedCount += 1;
        continue;
      }

      insertedCount += 1;
      if (!latestBucketTimestamp || bucketTimestamp > latestBucketTimestamp) {
        latestBucketTimestamp = bucketTimestamp;
        latestInsertedBucket = bucket;
      }
    }

    if (latestBucketTimestamp && latestInsertedBucket) {
      await client.query(UPSERT_LATEST_SQL, [
        typeId,
        regionId,
        latestBucketTimestamp.toISOString(),
        latestInsertedBucket.lowest ?? null,
        latestInsertedBucket.highest ?? null,
        latestInsertedBucket.median ?? null,
        latestInsertedBucket.volume ?? null,
        source,
        now.toISOString()
      ]);
    }

    await client.query("COMMIT");

    return { insertedCount, skippedCount, latestBucketTimestamp };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function sortBucketsByDate(buckets: MarketHistoryBucket[]): MarketHistoryBucket[] {
  return [...buckets].sort((a, b) => {
    const aTs = toBucketTimestamp(a.date).getTime();
    const bTs = toBucketTimestamp(b.date).getTime();
    return aTs - bTs;
  });
}
