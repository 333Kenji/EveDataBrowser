import { Pool } from "pg";
import { refreshMarketPrices } from "./market-prices.js";

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await refreshMarketPrices(pool);
    console.log(JSON.stringify({
      message: "market prices refreshed",
      fetched: result.fetched,
      updated: result.updated,
      refreshedEligibleViews: result.refreshedEligibleViews
    }));
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
