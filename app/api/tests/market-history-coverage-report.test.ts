import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { __internal as coverageInternal } from "../src/ingest/market-history-coverage-report.js";

const { loadCoverage, buildReport, resolveReportPath } = coverageInternal;

describe("market history coverage report", () => {
  let pool: Pool;
  let dispose: () => Promise<void>;

  beforeAll(() => {
    const db = newDb({ autoCreateForeignKeyIndices: true });
    db.public.none(`
      CREATE SCHEMA sde_master;

      CREATE TABLE sde_master.sde_types (
        type_id BIGINT PRIMARY KEY,
        market_group_id BIGINT,
        published BOOLEAN NOT NULL,
        name JSONB
      );

      CREATE TABLE market_price_history (
        type_id BIGINT NOT NULL,
        region_id BIGINT NOT NULL,
        ts_bucket_start DATE NOT NULL
      );
    `);

    const { Pool: MemPool } = db.adapters.createPg();
    pool = new MemPool();
    dispose = async () => {
      await pool.end();
    };
  });

  afterAll(async () => {
    await dispose();
  });

  it("computes bucket spans and missing days", async () => {
    await pool.query("TRUNCATE market_price_history RESTART IDENTITY");
    await pool.query("DELETE FROM sde_master.sde_types");

    await pool.query(
      `INSERT INTO sde_master.sde_types (type_id, market_group_id, published, name)
       VALUES
         (10, 1, TRUE, '{"en": "With Gaps"}'),
         (20, 2, TRUE, '{"en": "No History"}')`
    );

    await pool.query(
      `INSERT INTO market_price_history (type_id, region_id, ts_bucket_start)
       VALUES
         (10, 10000002, '2025-10-10'),
         (10, 10000002, '2025-10-12')`
    );

    const entries = await loadCoverage(pool, 10000002, []);
    const withHistory = entries.find((entry) => entry.typeId === 10);
    const missingHistory = entries.find((entry) => entry.typeId === 20);

    expect(withHistory).toBeDefined();
    expect(withHistory?.bucketCount).toBe(2);
    expect(withHistory?.spanDays).toBe(3);
    expect(withHistory?.missingDays).toBe(1);
    expect(withHistory?.firstDate).toBe("2025-10-10");
    expect(withHistory?.lastDate).toBe("2025-10-12");

    expect(missingHistory).toBeDefined();
    expect(missingHistory?.bucketCount).toBe(0);
    expect(missingHistory?.missingDays).toBeNull();

    const report = buildReport(entries, {
      regionId: 10000002,
      typeIds: [],
      limit: 1,
      outputPath: null,
      sortBy: "missing"
    });

    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.typeId).toEqual(missingHistory?.typeId);
    expect(report.withoutHistory).toBe(1);
  });

  it("writes reports into the default logs directory when no output is supplied", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "coverage-report-"));
    const overrideDir = join(tempDir, "logs", "ingestion");
    const originalEnv = process.env.MARKET_COVERAGE_REPORT_DIR;

    try {
      process.env.MARKET_COVERAGE_REPORT_DIR = overrideDir;
      const resolvedPath = await resolveReportPath(null);

      expect(resolvedPath.startsWith(overrideDir)).toBe(true);

      const payload = JSON.stringify({ ok: true });
      await writeFile(resolvedPath, payload, "utf8");
      const diskContents = await readFile(resolvedPath, "utf8");
      expect(diskContents).toBe(payload);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.MARKET_COVERAGE_REPORT_DIR;
      } else {
        process.env.MARKET_COVERAGE_REPORT_DIR = originalEnv;
      }
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
