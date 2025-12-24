import { Pool } from "pg";
import { config } from "../config.js";

async function getPool(): Promise<Pool> {
  return new Pool({
    connectionString: config.database.connectionString,
    ssl: config.database.useSsl ? { rejectUnauthorized: false } : undefined
  });
}

export async function ensureMarketTables(pool?: Pool): Promise<void> {
  const localPool = pool ?? await getPool();

  try {
    await localPool.query(`
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
    await localPool.query(`
      CREATE INDEX IF NOT EXISTS market_price_history_region_idx
        ON public.market_price_history (region_id);
    `);
    await localPool.query(`
      CREATE INDEX IF NOT EXISTS market_price_history_date_idx
        ON public.market_price_history (ts_bucket_start);
    `);
    await localPool.query(`
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
    await localPool.query(`
      CREATE TABLE IF NOT EXISTS public.item_prices_fact (
        type_id bigint PRIMARY KEY,
        average numeric,
        adjusted numeric,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await localPool.query(`
      CREATE TABLE IF NOT EXISTS public.market_history_refresh_cache (
        type_id bigint NOT NULL,
        region_id bigint NOT NULL,
        cached_until timestamptz,
        last_checked_at timestamptz,
        PRIMARY KEY (type_id, region_id)
      );
    `);
    await localPool.query(`
      CREATE INDEX IF NOT EXISTS market_history_refresh_cache_cached_until_idx
        ON public.market_history_refresh_cache (cached_until);
    `);
  } finally {
    if (!pool) {
      await localPool.end();
    }
  }
}

export async function ensureMarketEligibilityViews(pool?: Pool): Promise<void> {
  const localPool = pool ?? await getPool();

  try {
    const result = await localPool.query<{ regclass: string | null }>(
      "SELECT to_regclass('sde_master.sde_types') AS regclass"
    );
    if (!result.rows[0]?.regclass) {
      return;
    }

    const viewResult = await localPool.query<{ regclass: string | null }>(
      "SELECT to_regclass('public.market_eligible_types') AS regclass"
    );
    if (!viewResult.rows[0]?.regclass) {
      await localPool.query(`
        CREATE MATERIALIZED VIEW public.market_eligible_types AS
        SELECT DISTINCT st.type_id::bigint AS type_id
        FROM sde_master.sde_types AS st
        WHERE st.type_id IS NOT NULL
          AND st.published IS TRUE
          AND st.market_group_id IS NOT NULL;
      `);
      await localPool.query(`
        CREATE UNIQUE INDEX market_eligible_types_pk
          ON public.market_eligible_types (type_id);
      `);
    }

    const unionResult = await localPool.query<{ regclass: string | null }>(
      "SELECT to_regclass('public.market_eligible_types_union') AS regclass"
    );
    if (!unionResult.rows[0]?.regclass) {
      await localPool.query(`
        CREATE MATERIALIZED VIEW public.market_eligible_types_union AS
        SELECT type_id
        FROM public.market_eligible_types
        UNION
        SELECT type_id
        FROM public.item_prices_fact;
      `);
      await localPool.query(`
        CREATE UNIQUE INDEX market_eligible_types_union_pk
          ON public.market_eligible_types_union (type_id);
      `);
    }
  } finally {
    if (!pool) {
      await localPool.end();
    }
  }
}
