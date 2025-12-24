import { Pool } from "pg";
import { config } from "../config.js";

export async function ensureMarketTables(): Promise<void> {
  const pool = new Pool({
    connectionString: config.database.connectionString,
    ssl: config.database.useSsl ? { rejectUnauthorized: false } : undefined
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.market_price_history (
        type_id bigint NOT NULL,
        region_id bigint NOT NULL,
        ts_bucket_start timestamptz NOT NULL,
        average_price double precision NOT NULL,
        high_price double precision NOT NULL,
        low_price double precision NOT NULL,
        median_price double precision,
        volume double precision NOT NULL,
        order_count double precision,
        source text NOT NULL,
        last_ingested_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT market_price_history_type_region_bucket_key PRIMARY KEY (type_id, region_id, ts_bucket_start)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS market_price_history_region_idx
        ON public.market_price_history (region_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS market_price_history_date_idx
        ON public.market_price_history (ts_bucket_start);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.market_latest_stats (
        type_id bigint NOT NULL,
        region_id bigint NOT NULL,
        last_seen_at timestamptz NOT NULL,
        snapshot_low double precision,
        snapshot_high double precision,
        snapshot_median double precision,
        snapshot_volume double precision,
        source text NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT market_latest_stats_type_region_key PRIMARY KEY (type_id, region_id)
      );
    `);
  } finally {
    await pool.end();
  }
}
