import type { Pool } from "pg";

export interface RefreshEligibleViewOptions {
  concurrent?: boolean;
}

export async function refreshEligibleTypeViews(
  pool: Pool,
  options: RefreshEligibleViewOptions = {}
): Promise<{ typesMs: number; unionMs: number }> {
  const keyword = options.concurrent === false ? "" : "CONCURRENTLY";
  const startTypes = Date.now();
  await pool.query(`REFRESH MATERIALIZED VIEW ${keyword} public.market_eligible_types;`);
  const typesMs = Date.now() - startTypes;

  const startUnion = Date.now();
  await pool.query(`REFRESH MATERIALIZED VIEW ${keyword} public.market_eligible_types_union;`);
  const unionMs = Date.now() - startUnion;

  return { typesMs, unionMs };
}
