import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";
import { config } from "../config.js";
import { ensureMarketEligibilityViews, ensureMarketTables } from "./market-tables.js";

const MARKET_BOOTSTRAP_FLAG = process.env.MARKET_BOOTSTRAP_ON_START?.toLowerCase() === "true";
const MARKET_BOOTSTRAP_MIN_INTERVAL_HOURS = Number.parseFloat(
  process.env.MARKET_BOOTSTRAP_MIN_INTERVAL_HOURS ?? "24"
);
const MARKET_BOOTSTRAP_REGION_ID = Number.parseInt(
  process.env.MARKET_BOOTSTRAP_REGION_ID ?? "10000002",
  10
);
const MARKET_BOOTSTRAP_DAYS = Number.parseInt(
  process.env.MARKET_BOOTSTRAP_DAYS ?? "7",
  10
);
const MARKET_BOOTSTRAP_IGNORE_CACHE = process.env.MARKET_BOOTSTRAP_IGNORE_CACHE?.toLowerCase() === "true";
const DEFAULT_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
// dist/ops -> dist -> api -> app -> (workspace root)
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const MARKET_INGEST_SCRIPT = path.join(WORKSPACE_ROOT, "app/api/dist/ingest/ingest-esi-market-history.js");

function resolveBootstrapIntervalMs(): number {
  if (!Number.isFinite(MARKET_BOOTSTRAP_MIN_INTERVAL_HOURS) || MARKET_BOOTSTRAP_MIN_INTERVAL_HOURS <= 0) {
    return DEFAULT_MIN_INTERVAL_MS;
  }
  return Math.round(MARKET_BOOTSTRAP_MIN_INTERVAL_HOURS * 60 * 60 * 1000);
}

async function shouldRunBootstrap(pool: Pool): Promise<boolean> {
  const intervalMs = resolveBootstrapIntervalMs();

  await pool.query("CREATE SCHEMA IF NOT EXISTS sde_master");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sde_master.market_bootstrap_state (
      id int PRIMARY KEY,
      last_attempt_at timestamptz,
      last_success_at timestamptz
    );
  `);
  await pool.query("INSERT INTO sde_master.market_bootstrap_state (id) VALUES (1) ON CONFLICT DO NOTHING");

  const result = await pool.query(
    "SELECT last_success_at FROM sde_master.market_bootstrap_state WHERE id = 1"
  );
  const lastSuccess = result.rows[0]?.last_success_at instanceof Date
    ? (result.rows[0].last_success_at as Date)
    : result.rows[0]?.last_success_at
      ? new Date(result.rows[0].last_success_at)
      : null;

  if (!lastSuccess || !Number.isFinite(lastSuccess.getTime())) {
    return true;
  }

  return Date.now() - lastSuccess.getTime() >= intervalMs;
}

async function markBootstrapAttempt(pool: Pool): Promise<void> {
  await pool.query("UPDATE sde_master.market_bootstrap_state SET last_attempt_at = NOW() WHERE id = 1");
}

async function markBootstrapSuccess(pool: Pool): Promise<void> {
  await pool.query("UPDATE sde_master.market_bootstrap_state SET last_success_at = NOW() WHERE id = 1");
}

function runScript(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
      },
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(" ")}`));
      } else {
        resolve();
      }
    });

    child.on("error", reject);
  });
}

export async function runMarketBootstrapIfNeeded(): Promise<void> {
  if (!MARKET_BOOTSTRAP_FLAG) {
    return;
  }

  const pool = new Pool({
    connectionString: config.database.connectionString,
    ssl: config.database.useSsl ? { rejectUnauthorized: false } : undefined
  });

  try {
    const shouldRun = await shouldRunBootstrap(pool);
    if (!shouldRun) {
      // eslint-disable-next-line no-console
      console.log("[market-bootstrap] skipped (last success < interval)");
      return;
    }

    await ensureMarketTables(pool);
    await ensureMarketEligibilityViews(pool);
    await markBootstrapAttempt(pool);
    // eslint-disable-next-line no-console
    console.log("[market-bootstrap] importing market history");

    const args = [MARKET_INGEST_SCRIPT, "--region", String(MARKET_BOOTSTRAP_REGION_ID), "--days", String(MARKET_BOOTSTRAP_DAYS)];
    if (MARKET_BOOTSTRAP_IGNORE_CACHE) {
      args.push("--ignore-cache");
    }

    await runScript(process.execPath, args);
    await markBootstrapSuccess(pool);
    // eslint-disable-next-line no-console
    console.log("[market-bootstrap] completed");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[market-bootstrap] failed; continuing API startup", error);
  } finally {
    await pool.end();
  }
}
