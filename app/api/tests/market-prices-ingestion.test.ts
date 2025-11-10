import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { refreshMarketPrices } from "../src/ingest/market-prices.js";

interface TestContext {
  pool: Pool;
  dispose: () => Promise<void>;
}

function createInMemoryPool(): TestContext {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.none(`
    CREATE TABLE item_prices_fact (
      type_id bigint PRIMARY KEY,
      average numeric,
      adjusted numeric,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const { Pool: MemPool } = db.adapters.createPg();
  const pool = new MemPool();
  return {
    pool,
    dispose: async () => {
      await pool.end();
    }
  };
}

describe("market prices ingestion", () => {
  let context: TestContext;

  beforeAll(() => {
    context = createInMemoryPool();
  });

  afterAll(async () => {
    await context.dispose();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("upserts prices and skips eligible refresh when disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([
        { type_id: 34, average_price: 4.2, adjusted_price: 3.9 },
        { type_id: 35, average_price: 6.1, adjusted_price: 5.7 }
      ])
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshMarketPrices(context.pool, { refreshEligibleViews: false, chunkSize: 1 });
    expect(result.fetched).toBe(2);
    expect(result.updated).toBeGreaterThanOrEqual(2);
    expect(result.refreshedEligibleViews).toBe(false);

    const rows = await context.pool.query("SELECT type_id, average::float, adjusted::float FROM item_prices_fact ORDER BY type_id ASC");
    expect(rows.rows).toEqual([
      { type_id: 34, average: 4.2, adjusted: 3.9 },
      { type_id: 35, average: 6.1, adjusted: 5.7 }
    ]);
  });
});
