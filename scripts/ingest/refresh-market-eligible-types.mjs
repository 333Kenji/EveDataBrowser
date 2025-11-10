#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import process from "node:process";
import { Pool } from "pg";

function log(message, extra = {}) {
  const payload = Object.keys(extra).length > 0 ? { message, ...extra } : { message };
  console.log(JSON.stringify(payload));
}

const CONCURRENT = process.env.MARKET_ELIGIBLE_REFRESH_CONCURRENT !== "0";
const DATABASE_URL = process.env.DATABASE_URL ?? process.env.PGURL ?? "postgresql://eveapp:eveapp@localhost:5432/eveapp";

async function refresh(pool, viewName) {
  const started = performance.now();
  const keyword = CONCURRENT ? "CONCURRENTLY" : "";
  await pool.query(`REFRESH MATERIALIZED VIEW ${keyword} ${viewName};`);
  return Math.round(performance.now() - started);
}

async function run() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const typesMs = await refresh(pool, "public.market_eligible_types");
    log("refreshed market_eligible_types", { durationMs: typesMs, concurrent: CONCURRENT });
    const unionMs = await refresh(pool, "public.market_eligible_types_union");
    log("refreshed market_eligible_types_union", { durationMs: unionMs, concurrent: CONCURRENT });
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
