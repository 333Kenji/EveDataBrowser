import { Pool } from "pg";
import { refreshStructureOrders } from "./structure-orders-ingestion.js";

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await refreshStructureOrders(pool);
    console.log(JSON.stringify({
      message: "structure orders refreshed",
      fetched: result.fetched,
      upserted: result.upserted
    }));
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
