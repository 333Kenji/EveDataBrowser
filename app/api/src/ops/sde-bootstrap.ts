import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";
import { config } from "../config.js";

const SDE_BOOTSTRAP_FLAG = process.env.SDE_BOOTSTRAP_ON_START?.toLowerCase() === "true";
const SDE_BOOTSTRAP_MIN_INTERVAL_HOURS = Number.parseFloat(process.env.SDE_BOOTSTRAP_MIN_INTERVAL_HOURS ?? "24");
// dist/ops -> dist -> api -> app -> (workspace root)
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const SDE_SCRIPT = path.join(WORKSPACE_ROOT, "scripts/ingest/check-sde-latest.mjs");
const DEFAULT_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

function resolveBootstrapIntervalMs(): number {
  if (!Number.isFinite(SDE_BOOTSTRAP_MIN_INTERVAL_HOURS) || SDE_BOOTSTRAP_MIN_INTERVAL_HOURS <= 0) {
    return DEFAULT_MIN_INTERVAL_MS;
  }
  return Math.round(SDE_BOOTSTRAP_MIN_INTERVAL_HOURS * 60 * 60 * 1000);
}

async function shouldRunBootstrap(pool: Pool): Promise<boolean> {
  const intervalMs = resolveBootstrapIntervalMs();

  await pool.query("CREATE SCHEMA IF NOT EXISTS sde_master");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sde_master.sde_bootstrap_state (
      id int PRIMARY KEY,
      last_attempt_at timestamptz,
      last_success_at timestamptz
    );
  `);
  await pool.query("INSERT INTO sde_master.sde_bootstrap_state (id) VALUES (1) ON CONFLICT DO NOTHING");

  const result = await pool.query("SELECT last_attempt_at FROM sde_master.sde_bootstrap_state WHERE id = 1");
  const lastAttempt = result.rows[0]?.last_attempt_at instanceof Date
    ? (result.rows[0].last_attempt_at as Date)
    : result.rows[0]?.last_attempt_at
      ? new Date(result.rows[0].last_attempt_at)
      : null;

  if (!lastAttempt || !Number.isFinite(lastAttempt.getTime())) {
    return true;
  }

  return Date.now() - lastAttempt.getTime() >= intervalMs;
}

async function markBootstrapAttempt(pool: Pool): Promise<void> {
  await pool.query("UPDATE sde_master.sde_bootstrap_state SET last_attempt_at = NOW() WHERE id = 1");
}

async function markBootstrapSuccess(pool: Pool): Promise<void> {
  await pool.query("UPDATE sde_master.sde_bootstrap_state SET last_success_at = NOW() WHERE id = 1");
}

function runScript(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        // Constrain heap for SDE import on small instances (Render free tier is 512Mi).
        SDE_HEAP_MB: process.env.SDE_HEAP_MB ?? "256",
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

export async function runSdeBootstrapIfNeeded(): Promise<void> {
  if (!SDE_BOOTSTRAP_FLAG) {
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
      console.log("[sde-bootstrap] skipped (last attempt < 24h)");
      return;
    }

    await markBootstrapAttempt(pool);
    // eslint-disable-next-line no-console
    console.log("[sde-bootstrap] flag enabled; importing SDE and refreshing eligibility views");
    await runScript(process.execPath, [SDE_SCRIPT]);
    await runScript("npm", ["run", "market:eligible:refresh"]);
    await markBootstrapSuccess(pool);
    // eslint-disable-next-line no-console
    console.log("[sde-bootstrap] completed");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[sde-bootstrap] failed; continuing API startup", error);
  } finally {
    await pool.end();
  }
}
