#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { Pool } from "pg";

const LOOKBACK_DAYS = Number.parseInt(process.env.MARKET_QA_LOOKBACK_DAYS ?? "30", 10) || 30;
const DUPLICATE_LIMIT = Number.parseInt(process.env.MARKET_QA_DUPLICATE_LIMIT ?? "200", 10) || 200;
const MISSING_LIMIT = Number.parseInt(process.env.MARKET_QA_MISSING_LIMIT ?? "500", 10) || 500;
const STALE_LIMIT = Number.parseInt(process.env.MARKET_QA_STALE_LIMIT ?? "200", 10) || 200;
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://eveapp:eveapp@localhost:5432/eveapp";
const OUTPUT_DIR = process.env.MARKET_QA_OUTPUT_DIR
  ? resolve(process.env.MARKET_QA_OUTPUT_DIR)
  : resolve(process.cwd(), "logs", "ingestion", "qa");

const reports = [];

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const missingDays = await pool.query(
      `
        WITH recent_combos AS (
          SELECT DISTINCT type_id, region_id
          FROM market_price_history
          WHERE ts_bucket_start >= (current_date - $1::int * INTERVAL '1 day') - INTERVAL '7 days'
        ),
        recent_days AS (
          SELECT generate_series(current_date - $1::int, current_date, INTERVAL '1 day')::date AS day
        )
        SELECT
          combos.type_id,
          combos.region_id,
          days.day AS missing_day
        FROM recent_combos combos
        CROSS JOIN recent_days days
        LEFT JOIN market_price_history mph
          ON mph.type_id = combos.type_id
         AND mph.region_id = combos.region_id
         AND DATE(mph.ts_bucket_start AT TIME ZONE 'UTC') = days.day
        WHERE mph.ts_bucket_start IS NULL
        ORDER BY combos.type_id, combos.region_id, days.day
        LIMIT $2;
      `,
      [LOOKBACK_DAYS, MISSING_LIMIT]
    );

    const duplicateBuckets = await pool.query(
      `
        SELECT type_id, region_id, DATE(ts_bucket_start AT TIME ZONE 'UTC') AS bucket_day, COUNT(*) AS bucket_count
        FROM market_price_history
        GROUP BY type_id, region_id, bucket_day
        HAVING COUNT(*) > 1
        ORDER BY bucket_count DESC
        LIMIT $1;
      `,
      [DUPLICATE_LIMIT]
    );

    const staleLatest = await pool.query(
      `
        SELECT type_id, region_id, updated_at
        FROM market_latest_stats
        WHERE updated_at < now() - INTERVAL '24 hours'
        ORDER BY updated_at ASC
        LIMIT $1;
      `,
      [STALE_LIMIT]
    );

    await mkdir(OUTPUT_DIR, { recursive: true });
    const payload = {
      generatedAt: new Date().toISOString(),
      lookbackDays: LOOKBACK_DAYS,
      missingDays: missingDays.rows,
      duplicateBuckets: duplicateBuckets.rows,
      staleLatest: staleLatest.rows
    };
    const fileName = `qa-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await writeFile(resolve(OUTPUT_DIR, fileName), `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8" });
    await writeFile(resolve(OUTPUT_DIR, "latest.json"), `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8" });
    reports.push(payload);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
