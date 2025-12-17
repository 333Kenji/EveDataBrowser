import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SDE_BOOTSTRAP_FLAG = process.env.SDE_BOOTSTRAP_ON_START?.toLowerCase() === "true";
// dist/ops -> dist -> api -> app -> (workspace root)
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const SDE_SCRIPT = path.join(WORKSPACE_ROOT, "scripts/ingest/check-sde-latest.mjs");

function runScript(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: WORKSPACE_ROOT,
      env: process.env,
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

  // eslint-disable-next-line no-console
  console.log("[sde-bootstrap] flag enabled; importing SDE and refreshing eligibility views");

  await runScript(process.execPath, [SDE_SCRIPT]);
  await runScript("npm", ["run", "market:eligible:refresh"]);

  // eslint-disable-next-line no-console
  console.log("[sde-bootstrap] completed");
}
