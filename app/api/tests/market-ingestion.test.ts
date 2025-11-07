import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { appendMarketHistory, type MarketHistoryBucket } from "../src/ingest/market-history-ingestion.js";
import { __internal as ingestionInternal } from "../src/ingest/ingest-esi-market-history.js";

const {
  loadTypeIdsFromSource,
  applyAdaptiveThrottling,
  buildProgressLine,
} = ingestionInternal;

interface TestContext {
  pool: Pool;
  dispose: () => Promise<void>;
}

function createInMemoryPool(): TestContext {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.none(`
    CREATE TABLE market_price_history (
      type_id BIGINT NOT NULL,
      region_id BIGINT NOT NULL,
      ts_bucket_start TIMESTAMPTZ NOT NULL,
      average_price DOUBLE PRECISION NOT NULL,
      high_price DOUBLE PRECISION NOT NULL,
      low_price DOUBLE PRECISION NOT NULL,
      median_price DOUBLE PRECISION,
      volume DOUBLE PRECISION NOT NULL,
      order_count DOUBLE PRECISION,
      source TEXT NOT NULL,
      last_ingested_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (type_id, region_id, ts_bucket_start)
    );

    CREATE TABLE market_latest_stats (
      type_id BIGINT NOT NULL,
      region_id BIGINT NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL,
      snapshot_low DOUBLE PRECISION,
      snapshot_high DOUBLE PRECISION,
      snapshot_median DOUBLE PRECISION,
      snapshot_volume DOUBLE PRECISION,
      source TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (type_id, region_id)
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

describe("appendMarketHistory", () => {
  let context: TestContext;

  beforeAll(() => {
    context = createInMemoryPool();
  });

  afterAll(async () => {
    await context.dispose();
  });

  beforeEach(async () => {
    await context.pool.query("TRUNCATE market_price_history RESTART IDENTITY");
    await context.pool.query("TRUNCATE market_latest_stats RESTART IDENTITY");
  });

  it("inserts new buckets and skips duplicates on reruns", async () => {
    const buckets: MarketHistoryBucket[] = [
      {
        date: "2025-10-10",
        average: 158_900_000,
        highest: 160_000_000,
        lowest: 155_000_000,
        volume: 12,
        orderCount: 6,
        median: 158_000_000
      },
      {
        date: "2025-10-11",
        average: 159_100_000,
        highest: 161_000_000,
        lowest: 156_000_000,
        volume: 15,
        orderCount: 7,
        median: 158_500_000
      }
    ];

    const firstResult = await appendMarketHistory(context.pool, 603, 10000002, buckets, {
      now: new Date("2025-10-12T00:00:00Z")
    });

    expect(firstResult.insertedCount).toBe(2);
    expect(firstResult.skippedCount).toBe(0);
    expect(firstResult.latestBucketTimestamp?.toISOString()).toBe("2025-10-11T00:00:00.000Z");

    const secondResult = await appendMarketHistory(context.pool, 603, 10000002, buckets, {
      now: new Date("2025-10-13T00:00:00Z")
    });

    expect(secondResult.insertedCount).toBe(0);
    expect(secondResult.skippedCount).toBe(2);
    expect(secondResult.latestBucketTimestamp).toBeNull();

    const historyRows = await context.pool.query(
      "SELECT COUNT(*)::int AS count FROM market_price_history WHERE type_id = $1 AND region_id = $2",
      [603, 10000002]
    );
    expect(historyRows.rows[0]?.count).toBe(2);
  });

  it("updates latest stats only when encountering newer buckets", async () => {
    const initialBucket: MarketHistoryBucket[] = [
      {
        date: "2025-10-12",
        average: 160_000_000,
        highest: 162_000_000,
        lowest: 158_000_000,
        volume: 20,
        orderCount: 9,
        median: 160_000_000
      }
    ];

    await appendMarketHistory(context.pool, 34, 10000002, initialBucket, {
      now: new Date("2025-10-13T00:00:00Z")
    });

    const staleBucket: MarketHistoryBucket[] = [
      {
        date: "2025-10-11",
        average: 159_000_000,
        highest: 160_000_000,
        lowest: 157_000_000,
        volume: 18,
        orderCount: 8,
        median: 158_500_000
      }
    ];

    await appendMarketHistory(context.pool, 34, 10000002, staleBucket, {
      now: new Date("2025-10-14T00:00:00Z")
    });

    const latestStats = await context.pool.query(
      "SELECT last_seen_at, snapshot_low, snapshot_high, snapshot_volume FROM market_latest_stats WHERE type_id = $1 AND region_id = $2",
      [34, 10000002]
    );

    expect(latestStats.rows[0]?.last_seen_at.toISOString()).toBe("2025-10-12T00:00:00.000Z");
    expect(latestStats.rows[0]?.snapshot_low).toBe(158_000_000);
    expect(latestStats.rows[0]?.snapshot_high).toBe(162_000_000);
    expect(latestStats.rows[0]?.snapshot_volume).toBe(20);
  });
});

describe("ingestion helpers", () => {
  it("loads type IDs from a coverage report", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "coverage-types-"));
    const reportPath = join(tempDir, "report.json");

    await writeFile(reportPath, JSON.stringify({
      entries: [
        { typeId: 600, missingDays: 5 },
        { typeId: 601, missingDays: 2 },
        { typeId: 600, missingDays: 1 }
      ]
    }), "utf8");

    try {
      const result = await loadTypeIdsFromSource(reportPath);
      expect(result).toEqual([600, 601]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("applies adaptive throttling delays when limits are low", async () => {
    const sleepSpy = vi.fn(async () => {});

    await applyAdaptiveThrottling(
      { group: null, limit: null, remaining: 10, used: 15 },
      { remain: 8, reset: 20 },
      777,
      sleepSpy
    );

    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy.mock.calls[0]?.[0]).toBeGreaterThan(0);
    expect(sleepSpy.mock.calls[1]?.[0]).toBeGreaterThan(0);
  });

  it("formats progress lines with header metadata", () => {
    const line = buildProgressLine({
      processed: 5,
      total: 10,
      etaMs: 15000,
      typeId: 123,
      source: "esi",
      attempted: 90,
      missing: 30,
      inserted: 25,
      skipped: 5,
      status: "ingested",
      rateLimit: { group: "esi", limit: "100", remaining: 20, used: 80 },
      errorLimit: { remain: 15, reset: 60 },
      cache: { expires: "Thu, 16 Oct 2025 00:00:00 GMT", lastModified: "Thu, 15 Oct 2025 00:00:00 GMT", etag: "xyz" }
    });

    expect(line).toContain("[5/10]");
    expect(line).toContain("source=esi");
    expect(line).toContain("rateRemain=20");
    expect(line).toContain("errorRemain=15");
    expect(line).toContain("cacheExpires=Thu, 16 Oct 2025 00:00:00 GMT");
    expect(line).toContain("etag=xyz");
  });
});
