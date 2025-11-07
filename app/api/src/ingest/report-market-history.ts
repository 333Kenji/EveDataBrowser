import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { generateMarketHistoryReport } from "./market-history-report.js";

interface CliOptions {
  regionId: number;
  days: number;
  limit: number | null;
  outputPath: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    regionId: 10000002,
    days: 7,
    limit: null,
    outputPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--region":
      case "--regionId": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("--region requires a value");
        }
        options.regionId = Number.parseInt(next, 10);
        index += 1;
        break;
      }
      case "--days": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("--days requires a value");
        }
        options.days = Number.parseInt(next, 10);
        index += 1;
        break;
      }
      case "--limit": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("--limit requires a value");
        }
        options.limit = Number.parseInt(next, 10);
        index += 1;
        break;
      }
      case "--output":
      case "--outputPath": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("--output requires a value");
        }
        options.outputPath = next;
        index += 1;
        break;
      }
      default:
        if (token.startsWith("--")) {
          throw new Error(`Unknown flag: ${token}`);
        }
        break;
    }
  }

  if (!Number.isFinite(options.regionId) || options.regionId <= 0) {
    throw new Error(`Invalid regionId: ${options.regionId}`);
  }
  if (!Number.isFinite(options.days) || options.days <= 0) {
    throw new Error(`Invalid days value: ${options.days}`);
  }
  if (options.limit !== null && (!Number.isFinite(options.limit) || options.limit <= 0)) {
    throw new Error(`Invalid limit: ${options.limit}`);
  }

  return options;
}

function formatChecklist(typeIds: number[], regionId: number, days: number): string[] {
  if (typeIds.length === 0) {
    return [];
  }
  const chunks: string[] = [];
  const copy = [...typeIds];
  while (copy.length > 0) {
    const slice = copy.splice(0, 10);
    const args = slice.map((typeId) => `--type ${typeId}`).join(" ");
    chunks.push(`npm --prefix app/api run ingest:market:esi -- --region ${regionId} --days ${days} ${args}`);
  }
  return chunks;
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const report = await generateMarketHistoryReport(pool, {
      regionId: options.regionId,
      staleAfterDays: options.days,
      limit: options.limit,
    });

    const payload = {
      generatedAt: new Date().toISOString(),
      report,
      commands: formatChecklist(
        report.stale.concat(report.missing).map((item) => item.typeId),
        report.regionId,
        report.staleAfterDays,
      ),
    };

    console.info(JSON.stringify(payload, null, 2));

    if (options.outputPath) {
      const resolved = resolve(options.outputPath);
      await writeFile(resolved, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      console.info(`Report written to ${resolved}`);
    }
  } finally {
    await pool.end();
  }
}

const mainArg = process.argv[1];
const isMainModule = typeof mainArg === "string" && import.meta.url === pathToFileURL(resolve(mainArg)).href;

if (isMainModule) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
