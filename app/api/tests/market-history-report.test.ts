import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { generateMarketHistoryReport } from "../src/ingest/market-history-report.js";

interface TestContext {
  pool: Pool;
  dispose: () => Promise<void>;
}

function createContext(): TestContext {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.none(`
    CREATE SCHEMA sde_master;

    CREATE TABLE sde_master.sde_types (
      type_id BIGINT PRIMARY KEY,
      published BOOLEAN NOT NULL,
      market_group_id BIGINT,
      name JSONB
    );

    CREATE TABLE market_price_history (
      type_id BIGINT NOT NULL,
      region_id BIGINT NOT NULL,
      ts_bucket_start TIMESTAMPTZ NOT NULL
    );
  `);

  const { Pool: MemPool } = db.adapters.createPg();
  const pool = new MemPool();

  return {
    pool,
    dispose: async () => {
      await pool.end();
    },
  };
}

describe("generateMarketHistoryReport", () => {
  let context: TestContext;

  beforeAll(() => {
    context = createContext();
  });

  afterAll(async () => {
    await context.dispose();
  });

  it("categorises stale, missing, and fresh items", async () => {
    await context.pool.query(
      `INSERT INTO sde_master.sde_types (type_id, published, market_group_id, name)
       VALUES
         (100, true, 1, '{"en": "Fresh Item"}'),
         (200, true, 2, '{"en": "Stale Item"}'),
         (300, true, 3, '{"en": "Missing Item"}')
      `,
    );

    await context.pool.query(
      `INSERT INTO market_price_history (type_id, region_id, ts_bucket_start)
       VALUES
         (100, 10000002, '2025-10-12T00:00:00Z'),
         (200, 10000002, '2025-09-01T00:00:00Z'),
         (200, 10000002, '2025-09-15T00:00:00Z')
      `,
    );

    const report = await generateMarketHistoryReport(context.pool, {
      regionId: 10000002,
      staleAfterDays: 14,
      now: new Date("2025-10-13T00:00:00Z"),
    });

    expect(report.freshCount).toBe(1);
    expect(report.stale).toHaveLength(1);
    expect(report.stale[0]).toMatchObject({
      typeId: 200,
      lastBucket: "2025-09-15T00:00:00.000Z",
      name: "Stale Item",
    });
    expect(report.missing).toHaveLength(1);
    expect(report.missing[0]).toMatchObject({
      typeId: 300,
      lastBucket: null,
      name: "Missing Item",
    });
  });

  it("applies limits across stale and missing items", async () => {
    await context.pool.query("TRUNCATE market_price_history");
    await context.pool.query("DELETE FROM sde_master.sde_types");

    await context.pool.query(
      `INSERT INTO sde_master.sde_types (type_id, published, market_group_id, name)
       VALUES
         (400, true, 4, '{"en": "Old Item"}'),
         (500, true, 5, '{"en": "No History"}'),
         (600, true, 6, '{"en": "Fresh Item"}')
      `,
    );

    await context.pool.query(
      `INSERT INTO market_price_history (type_id, region_id, ts_bucket_start)
       VALUES
         (400, 10000002, '2025-07-01T00:00:00Z'),
         (600, 10000002, '2025-10-12T00:00:00Z')
      `,
    );

    const report = await generateMarketHistoryReport(context.pool, {
      regionId: 10000002,
      staleAfterDays: 30,
      now: new Date("2025-10-13T00:00:00Z"),
      limit: 1,
    });

    expect(report.stale).toHaveLength(1);
    expect(report.missing).toHaveLength(0);
    expect(report.stale[0].typeId).toBe(400);
  });
});
