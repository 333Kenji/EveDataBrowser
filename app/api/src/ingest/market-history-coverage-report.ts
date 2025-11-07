import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";

interface CliOptions {
  regionId: number;
  typeIds: number[];
  limit: number | null;
  outputPath: string | null;
  sortBy: "missing" | "type";
}

interface CoverageEntry {
  typeId: number;
  regionId: number;
  marketGroupId: number | null;
  name: string | null;
  firstDate: string | null;
  lastDate: string | null;
  bucketCount: number;
  spanDays: number | null;
  missingDays: number | null;
  coverageRatio: number | null;
}

interface CoverageReportPayload {
  generatedAt: string;
  regionId: number;
  totalTypes: number;
  listedTypes: number;
  withHistory: number;
  withoutHistory: number;
  averageCoverageRatio: number | null;
  entries: CoverageEntry[];
}

const DEFAULT_REGION_ID = 10000002;
const DEFAULT_REPORT_DIR = resolve(process.cwd(), "..", "..", "logs", "ingestion");
const REPORT_DIR_ENV = "MARKET_COVERAGE_REPORT_DIR";
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

function resolveDefaultReportDir(): string {
  const override = process.env[REPORT_DIR_ENV];
  if (override && override.trim().length > 0) {
    return resolve(override);
  }
  return DEFAULT_REPORT_DIR;
}

function toDateMs(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function toDateString(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

function calculateSpanDays(firstDate: unknown, lastDate: unknown): number | null {
  const firstMs = toDateMs(firstDate);
  const lastMs = toDateMs(lastDate);
  if (firstMs === null || lastMs === null) {
    return null;
  }
  const diff = Math.floor((lastMs - firstMs) / MILLIS_PER_DAY);
  if (!Number.isFinite(diff) || diff < 0) {
    return null;
  }
  return diff + 1;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    regionId: DEFAULT_REGION_ID,
    typeIds: [],
    limit: null,
    outputPath: null,
    sortBy: "missing"
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
      case "--type":
      case "--typeId": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("--type requires a value");
        }
        options.typeIds.push(Number.parseInt(next, 10));
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
      case "--sort": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("--sort requires a value");
        }
        if (next !== "missing" && next !== "type") {
          throw new Error("--sort must be either 'missing' or 'type'");
        }
        options.sortBy = next;
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
  if (options.limit !== null && (!Number.isFinite(options.limit) || options.limit <= 0)) {
    throw new Error(`Invalid limit: ${options.limit}`);
  }

  options.typeIds = Array.from(new Set(options.typeIds.filter((value) => Number.isFinite(value))));

  return options;
}

function buildTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
}

async function resolveReportPath(requested: string | null): Promise<string> {
  if (requested) {
    const resolvedPath = resolve(requested);
    await mkdir(dirname(resolvedPath), { recursive: true });
    return resolvedPath;
  }
  const reportDir = resolveDefaultReportDir();
  await mkdir(reportDir, { recursive: true });
  const filename = `market-coverage-${buildTimestamp()}.json`;
  return resolve(reportDir, filename);
}

function parseEnglishName(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const maybeEn = (raw as Record<string, unknown>)["en"];
  return typeof maybeEn === "string" && maybeEn.trim().length > 0 ? maybeEn : null;
}

function coverageSortKey(entry: CoverageEntry): number {
  if (entry.bucketCount === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (entry.missingDays === null) {
    return 0;
  }
  return entry.missingDays;
}

async function loadCoverage(
  pool: Pool,
  regionId: number,
  typeIds: number[]
): Promise<CoverageEntry[]> {
  const useTypeFilter = typeIds.length > 0;
  const sql = `
    WITH coverage AS (
      SELECT
        mph.type_id,
        mph.region_id,
        MIN(mph.ts_bucket_start)::date AS first_date,
        MAX(mph.ts_bucket_start)::date AS last_date,
        COUNT(*)::int AS bucket_count
      FROM market_price_history mph
      WHERE mph.region_id = $1
      GROUP BY mph.type_id, mph.region_id
    )
    SELECT
      t.type_id,
      $1::bigint AS region_id,
      t.market_group_id,
      t.name,
      c.first_date,
      c.last_date,
      c.bucket_count
    FROM sde_master.sde_types t
    LEFT JOIN coverage c ON c.type_id = t.type_id
    WHERE t.published = true
      AND t.market_group_id IS NOT NULL
      ${useTypeFilter ? "AND t.type_id = ANY($2::bigint[])\n" : ""}
    ORDER BY t.type_id;
  `;

  const parameters = useTypeFilter ? [regionId, typeIds] : [regionId];
  const result = await pool.query(sql, parameters);

  return result.rows.map((row) => {
    const bucketCount = row.bucket_count !== null ? Number(row.bucket_count) : 0;
    const firstDate = toDateString(row.first_date);
    const lastDate = toDateString(row.last_date);
    const spanDays = calculateSpanDays(row.first_date, row.last_date);
    const missingDays = spanDays !== null ? Math.max(spanDays - bucketCount, 0) : null;
    const coverageRatio = spanDays && spanDays > 0
      ? Number((bucketCount / spanDays).toFixed(4))
      : bucketCount > 0
        ? 1
        : null;

    return {
      typeId: Number(row.type_id),
      regionId,
      marketGroupId: row.market_group_id !== null ? Number(row.market_group_id) : null,
      name: parseEnglishName(row.name),
      firstDate,
      lastDate,
      bucketCount,
      spanDays,
      missingDays,
      coverageRatio
    } satisfies CoverageEntry;
  });
}

function buildReport(entries: CoverageEntry[], options: CliOptions): CoverageReportPayload {
  let sorted = [...entries];
  if (options.sortBy === "missing") {
    sorted.sort((a, b) => {
      const diff = coverageSortKey(b) - coverageSortKey(a);
      if (diff !== 0) {
        return diff;
      }
      return a.typeId - b.typeId;
    });
  } else {
    sorted.sort((a, b) => a.typeId - b.typeId);
  }

  if (options.limit !== null) {
    sorted = sorted.slice(0, options.limit);
  }

  const withHistory = entries.filter((entry) => entry.bucketCount > 0).length;
  const withoutHistory = entries.length - withHistory;
  const ratioSum = entries
    .filter((entry) => entry.coverageRatio !== null)
    .reduce((acc, entry) => acc + (entry.coverageRatio ?? 0), 0);
  const ratioCount = entries.filter((entry) => entry.coverageRatio !== null).length;

  return {
    generatedAt: new Date().toISOString(),
    regionId: options.regionId,
    totalTypes: entries.length,
    listedTypes: sorted.length,
    withHistory,
    withoutHistory,
    averageCoverageRatio: ratioCount > 0 ? Number((ratioSum / ratioCount).toFixed(4)) : null,
    entries: sorted,
  } satisfies CoverageReportPayload;
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const entries = await loadCoverage(pool, options.regionId, options.typeIds);
    const payload = buildReport(entries, options);

    console.info(JSON.stringify(payload, null, 2));

    const resolvedPath = await resolveReportPath(options.outputPath);
    await writeFile(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.info(`Coverage report written to ${resolvedPath}`);
  } finally {
    await pool.end();
  }
}

const mainArg = process.argv[1];
const isMainModule = typeof mainArg === "string" && import.meta.url === pathToFileURL(resolve(mainArg)).href;

export const __internal = {
  parseArgs,
  loadCoverage,
  buildReport,
  resolveReportPath,
  DEFAULT_REPORT_DIR,
  resolveDefaultReportDir,
};

if (isMainModule) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
