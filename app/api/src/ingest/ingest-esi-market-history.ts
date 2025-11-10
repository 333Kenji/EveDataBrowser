import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { Pool } from "pg";
import { appendMarketHistory, sortBucketsByDate, type MarketHistoryBucket } from "./market-history-ingestion.js";
import { RequestLimiter } from "./request-limiter.js";

interface CliOptions {
  regionId: number;
  days: number;
  typeIds: number[];
  typeLimit: number | null;
  typesFrom: string | null;
  dryRun: boolean;
  fixturePath: string | null;
  ignoreCache: boolean;
}

interface EsiHistoryEntry {
  date: string;
  average: number;
  highest: number;
  lowest: number;
  order_count?: number;
  volume: number;
}

interface CacheHeaders {
  expires: string | null;
  lastModified: string | null;
  etag: string | null;
}

interface RateLimitHeaders {
  group: string | null;
  limit: string | null;
  remaining: number | null;
  used: number | null;
}

interface ErrorLimitHeaders {
  remain: number | null;
  reset: number | null;
}

interface EsiHistoryResponse {
  buckets: MarketHistoryBucket[];
  cache: CacheHeaders;
  rateLimit: RateLimitHeaders;
  errorLimit: ErrorLimitHeaders;
}

type IngestionStatus = "ingested" | "up-to-date" | "dry-run" | "cache-valid" | "error";

interface IngestionSummaryEntry {
  typeId: number;
  source: string;
  attempted: number;
  missing: number;
  inserted: number;
  skipped: number;
  existing: number;
  latest: string | null;
  cache: CacheHeaders;
  rateLimit: RateLimitHeaders;
  errorLimit: ErrorLimitHeaders;
  status: IngestionStatus;
  message?: string;
  durationMs: number;
}

interface ProgressContext {
  processed: number;
  total: number;
  etaMs: number;
  typeId: number;
  source: string;
  attempted: number;
  missing: number;
  inserted: number;
  skipped: number;
  status: IngestionStatus;
  rateLimit: RateLimitHeaders;
  errorLimit: ErrorLimitHeaders;
  cache: CacheHeaders;
}

const DEFAULT_REGION_ID = 10000002;
const DEFAULT_DAYS = 90;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));
const WORKSPACE_ROOT = resolve(MODULE_DIR, "../../../../");
const INGESTION_LOG_DIR = resolve(WORKSPACE_ROOT, "logs", "ingestion");
const INGESTION_FAILURE_ARCHIVE_DIR = resolve(INGESTION_LOG_DIR, "archive");
const INGESTION_FAILURE_LATEST_PATH = resolve(INGESTION_LOG_DIR, "latest-failures.json");
const INGESTION_METRICS_PATH = resolve(INGESTION_LOG_DIR, "history-metrics.json");

const RATE_LIMIT_REMAINING_THRESHOLD = parsePositiveInt(process.env.MARKET_INGEST_RATE_THRESHOLD, 25);
const RATE_LIMIT_SLEEP_MS = parsePositiveInt(process.env.MARKET_INGEST_RATE_SLEEP_MS, 2000);
const ERROR_LIMIT_REMAINING_THRESHOLD = parsePositiveInt(process.env.MARKET_INGEST_ERROR_THRESHOLD, 10);
const ERROR_LIMIT_SLEEP_MS = parsePositiveInt(process.env.MARKET_INGEST_ERROR_SLEEP_MS, 5000);
const RETRY_BASE_DELAY_MS = parsePositiveInt(process.env.MARKET_INGEST_RETRY_BASE_MS, 3000);
const MAX_FETCH_ATTEMPTS = parsePositiveInt(process.env.MARKET_INGEST_MAX_ATTEMPTS, 5);
const RETRY_JITTER_RATIO = parseRatio(process.env.MARKET_INGEST_RETRY_JITTER_RATIO, 0.2);
const REQUEST_LIMITER_CONCURRENCY = parsePositiveInt(process.env.MARKET_INGEST_CONCURRENCY, 6);
const REQUEST_LIMITER_MAX_CONCURRENCY = parsePositiveInt(
  process.env.MARKET_INGEST_MAX_CONCURRENCY,
  Math.max(REQUEST_LIMITER_CONCURRENCY, 8)
);
const requestLimiter = new RequestLimiter({
  initialConcurrency: REQUEST_LIMITER_CONCURRENCY,
  maxConcurrency: REQUEST_LIMITER_MAX_CONCURRENCY,
  minConcurrency: 1
});
const REFRESH_CACHE_WINDOW_MINUTES = parsePositiveInt(process.env.MARKET_HISTORY_REFRESH_WINDOW_MINUTES, 180);
const limiterStats = { rateDelayMs: 0, errorDelayMs: 0 };

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    regionId: DEFAULT_REGION_ID,
    days: DEFAULT_DAYS,
    typeIds: [],
    typeLimit: null,
    typesFrom: null,
    dryRun: false,
    fixturePath: null,
    ignoreCache: false
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
      case "--fixture":
      case "--fixturePath": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("--fixture requires a value");
        }
        options.fixturePath = next;
        index += 1;
        break;
      }
      case "--type-limit":
      case "--typeLimit": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("--type-limit requires a value");
        }
        options.typeLimit = Number.parseInt(next, 10);
        index += 1;
        break;
      }
      case "--types-from":
      case "--typesFrom": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("--types-from requires a value");
        }
        options.typesFrom = next;
        index += 1;
        break;
      }
      case "--dry-run":
      case "--dryRun": {
        options.dryRun = true;
        break;
      }
      case "--ignore-cache":
      case "--ignoreCache": {
        options.ignoreCache = true;
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

  options.typeIds = Array.from(new Set(options.typeIds.filter((value) => Number.isFinite(value))));

  return options;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseRatio(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function parseHeaderInt(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatEta(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0%";
  }
  return `${value.toFixed(1)}%`;
}

function createEmptyCacheHeaders(): CacheHeaders {
  return { expires: null, lastModified: null, etag: null };
}

function createEmptyRateLimitHeaders(): RateLimitHeaders {
  return { group: null, limit: null, remaining: null, used: null };
}

function createEmptyErrorLimitHeaders(): ErrorLimitHeaders {
  return { remain: null, reset: null };
}

function calculateBackoffDelay(attempt: number): number {
  const normalizedAttempt = Math.max(1, attempt);
  const baseDelay = RETRY_BASE_DELAY_MS * normalizedAttempt;
  if (!Number.isFinite(baseDelay) || baseDelay <= 0) {
    return 0;
  }
  if (RETRY_JITTER_RATIO <= 0) {
    return Math.round(baseDelay);
  }
  const jitter = baseDelay * RETRY_JITTER_RATIO;
  const min = Math.max(baseDelay - jitter, 0);
  const max = baseDelay + jitter;
  const randomized = min + Math.random() * (max - min);
  return Math.round(randomized);
}

interface FailureReportContext {
  regionId: number;
  days: number;
  dryRun: boolean;
  startedAt: number;
  completedAt: number;
}

async function persistFailureReport(entries: IngestionSummaryEntry[], context: FailureReportContext): Promise<void> {
  try {
    await mkdir(INGESTION_LOG_DIR, { recursive: true });
    await mkdir(INGESTION_FAILURE_ARCHIVE_DIR, { recursive: true });
  } catch (error) {
    console.warn("Failed to ensure ingestion log directories exist", error);
    return;
  }

  const payload = {
    generatedAt: new Date(context.completedAt).toISOString(),
    startedAt: new Date(context.startedAt).toISOString(),
    regionId: context.regionId,
    days: context.days,
    dryRun: context.dryRun,
    errorCount: entries.length,
    entries,
  } satisfies {
    generatedAt: string;
    startedAt: string;
    regionId: number;
    days: number;
    dryRun: boolean;
    errorCount: number;
    entries: IngestionSummaryEntry[];
  };

  await writeFile(INGESTION_FAILURE_LATEST_PATH, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8" });

  if (entries.length === 0) {
    return;
  }

  const timestamp = new Date(context.completedAt).toISOString().replace(/[:.]/g, "-");
  const archivePath = resolve(INGESTION_FAILURE_ARCHIVE_DIR, `failures-${timestamp}.json`);
  await writeFile(archivePath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8" });
}

async function persistHistoryMetrics(
  summary: IngestionSummaryEntry[],
  context: { regionId: number; totals: { inserted: number; skipped: number; missing: number; errors: number }; durationMs: number }
): Promise<void> {
  await mkdir(INGESTION_LOG_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    regionId: context.regionId,
    totals: context.totals,
    durationMs: context.durationMs,
    cacheHits: summary.filter((entry) => entry.status === "cache-valid").length,
    ingested: summary.filter((entry) => entry.status === "ingested").length,
    upToDate: summary.filter((entry) => entry.status === "up-to-date").length,
    dryRun: summary.filter((entry) => entry.status === "dry-run").length,
    errors: summary.filter((entry) => entry.status === "error").length,
    limiter: {
      rateDelayMs: limiterStats.rateDelayMs,
      errorDelayMs: limiterStats.errorDelayMs
    }
  };
  await writeFile(INGESTION_METRICS_PATH, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8" });
}

function buildProgressLine(context: ProgressContext): string {
  const percentage = context.total > 0
    ? formatPercentage((context.processed / context.total) * 100)
    : "0.0%";

  return [
    `[${context.processed}/${context.total}]`,
    percentage,
    `eta=${formatEta(context.etaMs)}`,
    `type=${context.typeId}`,
    `source=${context.source}`,
    `attempted=${context.attempted}`,
    `missing=${context.missing}`,
    `inserted=${context.inserted}`,
    `skipped=${context.skipped}`,
    `status=${context.status}`,
    `rateRemain=${context.rateLimit.remaining ?? "n/a"}`,
    `errorRemain=${context.errorLimit.remain ?? "n/a"}`,
    `cacheExpires=${context.cache.expires ?? "n/a"}`,
    `cacheLastMod=${context.cache.lastModified ?? "n/a"}`,
    `etag=${context.cache.etag ?? "n/a"}`
  ].join(" ");
}

let lastProgressLineLength = 0;

function writeProgressLine(line: string, options?: { final?: boolean }): void {
  if (process.stdout.isTTY) {
    const targetLength = Math.max(line.length, lastProgressLineLength);
    const paddedLine = line.padEnd(targetLength, " ");
    process.stdout.write(`${paddedLine}${options?.final ? "\n" : "\r"}`);
    lastProgressLineLength = options?.final ? 0 : targetLength;
    return;
  }

  console.info(line);
}

function flushProgressLine(): void {
  if (!process.stdout.isTTY || lastProgressLineLength === 0) {
    return;
  }

  const blank = " ".repeat(lastProgressLineLength);
  process.stdout.write(`${blank}\r`);
  lastProgressLineLength = 0;
}

async function fetchEligibleTypeIds(pool: Pool, limit: number | null): Promise<number[]> {
  const resolvedLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? limit : null;
  const limitClause = resolvedLimit ? "LIMIT $1" : "";
  const sql = `
    SELECT type_id
    FROM public.market_eligible_types_union
    ORDER BY type_id
    ${limitClause};
  `;
  const parameters = limitClause ? [resolvedLimit] : [];
  const result = await pool.query<{ type_id: number | string }>(sql, parameters);
  return result.rows
    .map((row) => {
      if (typeof row.type_id === "number") {
        return row.type_id;
      }
      if (typeof row.type_id === "string") {
        const parsed = Number.parseInt(row.type_id, 10);
        return Number.isFinite(parsed) ? parsed : NaN;
      }
      return NaN;
    })
    .filter((value) => Number.isFinite(value))
    .map((value) => Number(value));
}

async function loadTypeIdsFromSource(pathOrList: string): Promise<number[]> {
  const resolvedPath = resolve(pathOrList);
  const collected: number[] = [];
  let streamError: unknown = null;

  try {
    const stream = createReadStream(resolvedPath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
    try {
      for await (const rawLine of rl) {
        const line = rawLine.trim();
        if (line.length === 0) {
          continue;
        }

        let parsedOnLine = false;

        for (const match of line.matchAll(/"typeId"\s*:\s*(-?\d+)/gi)) {
          const value = Number.parseInt(match[1] ?? "", 10);
          if (Number.isFinite(value)) {
            collected.push(value);
            parsedOnLine = true;
          }
        }

        for (const match of line.matchAll(/"type_id"\s*:\s*(-?\d+)/gi)) {
          const value = Number.parseInt(match[1] ?? "", 10);
          if (Number.isFinite(value)) {
            collected.push(value);
            parsedOnLine = true;
          }
        }

        if (parsedOnLine) {
          continue;
        }

        if (/^-?\d+(?:,)?$/.test(line)) {
          const parsed = Number.parseInt(line.replace(",", ""), 10);
          if (Number.isFinite(parsed)) {
            collected.push(parsed);
          }
          continue;
        }

        if (line.startsWith("[") || line.startsWith("{") || line.startsWith("]") || line.startsWith("}")) {
          continue;
        }
      }
    } finally {
      rl.close();
    }
  } catch (error) {
    streamError = error;
  }

  if (collected.length > 0) {
    return dedupeTypeIds(collected);
  }

  if (streamError && (streamError as NodeJS.ErrnoException)?.code === "ENOENT") {
    throw new Error(`Unable to read type list from ${resolvedPath}`);
  }

  try {
    const buffer = await readFile(resolvedPath, "utf8");
    const text = buffer.toString();

    try {
      const parsed = JSON.parse(text);

      if (Array.isArray(parsed)) {
        const values = parsed
          .map((entry) => (typeof entry === "number"
            ? entry
            : typeof entry === "string"
              ? Number.parseInt(entry, 10)
              : typeof entry?.typeId === "number"
                ? entry.typeId
                : typeof entry?.type_id === "number"
                  ? entry.type_id
                  : NaN))
          .filter((value) => Number.isFinite(value))
          .map((value) => Number(value));

        return dedupeTypeIds(values);
      }

      if (parsed && typeof parsed === "object") {
        const maybeEntries = (parsed as Record<string, unknown>).entries;
        if (Array.isArray(maybeEntries)) {
          const values = maybeEntries
            .map((entry) => {
              if (!entry || typeof entry !== "object") {
                return NaN;
              }
              const record = entry as Record<string, unknown>;
              if (typeof record.typeId === "number") {
                return record.typeId;
              }
              if (typeof record.type_id === "number") {
                return record.type_id;
              }
              return NaN;
            })
            .filter((value) => Number.isFinite(value))
            .map((value) => Number(value));

          return dedupeTypeIds(values);
        }
      }

      throw new Error("Unrecognised JSON format for type list");
    } catch (jsonError) {
      if (!(jsonError instanceof SyntaxError)) {
        throw jsonError;
      }
    }

    const values = text
      .split(/\r?\n/)
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter((value) => Number.isFinite(value))
      .map((value) => Number(value));

    return dedupeTypeIds(values);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new Error(`Unable to read type list from ${resolvedPath}`);
    }
    throw error;
  }
}

function dedupeTypeIds(typeIds: number[]): number[] {
  const seen = new Set<number>();
  const unique: number[] = [];

  for (const value of typeIds) {
    if (!Number.isFinite(value)) {
      continue;
    }
    const normalized = Number(value);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}

async function loadFixture(path: string): Promise<Record<number, MarketHistoryBucket[]>> {
  const buffer = await readFile(path);
  const parsed = JSON.parse(buffer.toString()) as Record<string, MarketHistoryBucket[]>;
  const normalized: Record<number, MarketHistoryBucket[]> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const typeId = Number.parseInt(key, 10);
    if (!Number.isFinite(typeId)) {
      continue;
    }
    normalized[typeId] = value;
  }
  return normalized;
}

async function readRefreshCacheEntry(pool: Pool, typeId: number, regionId: number): Promise<Date | null> {
  const result = await pool.query<{ cached_until: Date | null }>(
    "SELECT cached_until FROM market_history_refresh_cache WHERE type_id = $1 AND region_id = $2 LIMIT 1",
    [typeId, regionId]
  );
  const value = result.rows[0]?.cached_until;
  if (!value) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

async function upsertRefreshCacheEntry(pool: Pool, typeId: number, regionId: number, cachedUntil: Date, checkedAt: Date): Promise<void> {
  await pool.query(
    `
      INSERT INTO market_history_refresh_cache (type_id, region_id, cached_until, last_checked_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (type_id, region_id)
      DO UPDATE
        SET cached_until = GREATEST(market_history_refresh_cache.cached_until, EXCLUDED.cached_until),
            last_checked_at = EXCLUDED.last_checked_at;
    `,
    [typeId, regionId, cachedUntil.toISOString(), checkedAt.toISOString()]
  );
}

function resolveCachedUntil(cache: CacheHeaders, fallbackWindowMinutes: number): Date {
  if (cache.expires) {
    const expires = new Date(cache.expires);
    if (!Number.isNaN(expires.getTime())) {
      return expires;
    }
  }
  const windowMs = Math.max(1, fallbackWindowMinutes) * 60 * 1000;
  return new Date(Date.now() + windowMs);
}

async function fetchExistingBucketDates(
  pool: Pool,
  typeId: number,
  regionId: number,
  cutoff: Date | null
): Promise<Set<string>> {
  const parameters: Array<number | string> = [typeId, regionId];
  let sql = `
    SELECT to_char(ts_bucket_start, 'YYYY-MM-DD') AS bucket_date
    FROM market_price_history
    WHERE type_id = $1 AND region_id = $2
  `;
  if (cutoff) {
    sql += " AND ts_bucket_start >= $3";
    parameters.push(cutoff.toISOString());
  }
  sql += " ORDER BY bucket_date";
  const result = await pool.query<{ bucket_date: string }>(sql, parameters);
  return new Set(result.rows.map((row) => row.bucket_date));
}

async function fetchHistoryFromEsi(regionId: number, typeId: number, limiter: RequestLimiter): Promise<EsiHistoryResponse> {
  const url = new URL(`https://esi.evetech.net/latest/markets/${regionId}/history/`);
  url.searchParams.set("type_id", String(typeId));

  return limiter.schedule(async () => {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < MAX_FETCH_ATTEMPTS) {
      attempt += 1;
      try {
        const response = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "evedatabrowser-market-ingestion/0.1"
          }
        });
        limiter.adjustFromHeaders(response.headers);

        if (response.status === 429) {
          const retryAfterSeconds = parseHeaderInt(response.headers.get("retry-after"));
          const delayMs = (retryAfterSeconds ?? attempt * 2) * 1000;
          console.warn(`rate-limit hit for type=${typeId}; retrying in ${delayMs}ms (attempt ${attempt}/${MAX_FETCH_ATTEMPTS})`);
          await sleep(delayMs);
          continue;
        }

        if (!response.ok) {
          if (response.status >= 500 && attempt < MAX_FETCH_ATTEMPTS) {
            const backoff = calculateBackoffDelay(attempt);
            console.warn(`Transient ESI error ${response.status} for type=${typeId}; retrying in ${backoff}ms`);
            await sleep(backoff);
            continue;
          }
          const message = await response.text();
          throw new Error(`ESI request failed for type ${typeId}: ${response.status} ${response.statusText}${message ? ` - ${message}` : ""}`);
        }

        const payload = (await response.json()) as EsiHistoryEntry[];
        const cache: CacheHeaders = {
          expires: response.headers.get("expires"),
          lastModified: response.headers.get("last-modified"),
          etag: response.headers.get("etag")
        };
        const rateLimit: RateLimitHeaders = {
          group: response.headers.get("x-ratelimit-group"),
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: parseHeaderInt(response.headers.get("x-ratelimit-remaining")),
          used: parseHeaderInt(response.headers.get("x-ratelimit-used"))
        };
        const errorLimit: ErrorLimitHeaders = {
          remain: parseHeaderInt(response.headers.get("x-esi-error-limit-remain")),
          reset: parseHeaderInt(response.headers.get("x-esi-error-limit-reset"))
        };

        const buckets = payload.map((entry) => ({
          date: entry.date,
          average: entry.average,
          highest: entry.highest,
          lowest: entry.lowest,
          volume: entry.volume,
          orderCount: entry.order_count ?? null,
          median: null
        } satisfies MarketHistoryBucket));

        return { buckets, cache, rateLimit, errorLimit };
      } catch (error) {
        lastError = error;
        if (attempt >= MAX_FETCH_ATTEMPTS) {
          break;
        }
        const backoff = calculateBackoffDelay(attempt);
        console.warn(`Error fetching type=${typeId}: ${String(error)}; retrying in ${backoff}ms (attempt ${attempt}/${MAX_FETCH_ATTEMPTS})`);
        await sleep(backoff);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  });
}

async function applyAdaptiveThrottling(
  rateLimit: RateLimitHeaders,
  errorLimit: ErrorLimitHeaders,
  typeId: number,
  sleepFn: typeof sleep = sleep
): Promise<void> {
  if (rateLimit.remaining !== null && rateLimit.remaining <= RATE_LIMIT_REMAINING_THRESHOLD) {
    const multiplier = Math.max(RATE_LIMIT_REMAINING_THRESHOLD - rateLimit.remaining + 1, 1);
    const delay = RATE_LIMIT_SLEEP_MS * multiplier;
    console.info(`rate-limit cushion low (remaining=${rateLimit.remaining}) for type=${typeId}; pausing ${delay}ms`);
    limiterStats.rateDelayMs += delay;
    await sleepFn(delay);
  }

  if (errorLimit.remain !== null && errorLimit.remain <= ERROR_LIMIT_REMAINING_THRESHOLD) {
    const delay = ERROR_LIMIT_SLEEP_MS;
    console.warn(`error-limit cushion low (remain=${errorLimit.remain}) for type=${typeId}; pausing ${delay}ms`);
    limiterStats.errorDelayMs += delay;
    await sleepFn(delay);
  }
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const summary: IngestionSummaryEntry[] = [];
  const startedAt = Date.now();
  limiterStats.rateDelayMs = 0;
  limiterStats.errorDelayMs = 0;

  try {
    let combinedTypeIds: number[] = [...options.typeIds];

    if (options.typesFrom) {
      const fromSource = await loadTypeIdsFromSource(options.typesFrom);
      combinedTypeIds = combinedTypeIds.concat(fromSource);
    }

    let resolvedTypeIds: number[] | null = null;

    if (combinedTypeIds.length > 0) {
      const deduped = dedupeTypeIds(combinedTypeIds)
        .filter((value) => Number.isFinite(value) && value > 0);
      const limited = options.typeLimit && options.typeLimit > 0
        ? deduped.slice(0, options.typeLimit)
        : deduped;

      resolvedTypeIds = limited.length > 0 ? limited : null;

      if (!resolvedTypeIds) {
        console.warn("Type list from CLI and coverage file resolved to zero valid IDs; falling back to database query");
      }
    }

    if (!resolvedTypeIds || resolvedTypeIds.length === 0) {
      resolvedTypeIds = await fetchEligibleTypeIds(pool, options.typeLimit);
    }

    if (resolvedTypeIds.length === 0) {
      console.warn("No type IDs resolved for market ingestion");
      return;
    }

    const fixtureMap = options.fixturePath ? await loadFixture(options.fixturePath) : null;
    const now = new Date();
    const cutoff = new Date(now.getTime() - options.days * MILLIS_PER_DAY);
    const totalTypes = resolvedTypeIds.length;

    for (let index = 0; index < totalTypes; index += 1) {
      const typeId = resolvedTypeIds[index];
      const typeStartedAt = Date.now();
      try {
        const cachedUntil = options.ignoreCache
          ? null
          : await readRefreshCacheEntry(pool, typeId, options.regionId);
        if (!options.ignoreCache && cachedUntil && cachedUntil.getTime() > Date.now()) {
          await upsertRefreshCacheEntry(pool, typeId, options.regionId, cachedUntil, new Date());
          summary.push({
            typeId,
            source: "cache",
            attempted: 0,
            missing: 0,
            inserted: 0,
            skipped: 0,
            existing: 0,
            latest: null,
            cache: createEmptyCacheHeaders(),
            rateLimit: createEmptyRateLimitHeaders(),
            errorLimit: createEmptyErrorLimitHeaders(),
            status: "cache-valid",
            durationMs: 0
          });
          continue;
        }
        const existingDates = await fetchExistingBucketDates(pool, typeId, options.regionId, cutoff);

        const fixtureBuckets = fixtureMap?.[typeId];
        let fetchResult: EsiHistoryResponse;
        let source: string;

        if (fixtureBuckets) {
          fetchResult = {
            buckets: fixtureBuckets,
            cache: createEmptyCacheHeaders(),
            rateLimit: createEmptyRateLimitHeaders(),
            errorLimit: createEmptyErrorLimitHeaders()
          };
          source = "fixture";
        } else {
          fetchResult = await fetchHistoryFromEsi(options.regionId, typeId, requestLimiter);
          source = "esi";
        }

        const filteredBuckets = sortBucketsByDate(
          fetchResult.buckets.filter((bucket) => {
            const bucketDate = new Date(`${bucket.date}T00:00:00Z`);
            return !Number.isNaN(bucketDate.getTime()) && bucketDate >= cutoff;
          })
        );

        const missingBuckets = filteredBuckets.filter((bucket) => !existingDates.has(bucket.date));
        const attempted = filteredBuckets.length;
        const missingCount = missingBuckets.length;

        let inserted = 0;
        let skipped = 0;
        let latestIso: string | null = null;
        let status: IngestionStatus = options.dryRun ? "dry-run" : "up-to-date";

        if (missingCount > 0) {
          if (options.dryRun) {
            skipped = missingCount;
            const lastDryRunBucket = missingBuckets.at(-1)?.date ?? null;
            latestIso = lastDryRunBucket ? new Date(`${lastDryRunBucket}T00:00:00Z`).toISOString() : null;
          } else {
            const result = await appendMarketHistory(pool, typeId, options.regionId, missingBuckets, { now, source });
            inserted = result.insertedCount;
            skipped = result.skippedCount;
            latestIso = result.latestBucketTimestamp ? result.latestBucketTimestamp.toISOString() : null;
            if (inserted > 0) {
              status = "ingested";
            }
          }
        } else if (existingDates.size > 0) {
          const latestExistingKey = Array.from(existingDates).sort().at(-1) ?? null;
          latestIso = latestExistingKey ? new Date(`${latestExistingKey}T00:00:00Z`).toISOString() : null;
        }

        const processed = index + 1;
        const elapsedMs = Date.now() - startedAt;
        const avgMsPerType = elapsedMs / processed;
        const remainingTypes = totalTypes - processed;
        const etaMs = remainingTypes > 0 ? avgMsPerType * remainingTypes : 0;
        const durationMs = Date.now() - typeStartedAt;

        const progressLine = buildProgressLine({
          processed,
          total: totalTypes,
          etaMs,
          typeId,
          source,
          attempted,
          missing: missingCount,
          inserted,
          skipped,
          status,
          rateLimit: fetchResult.rateLimit,
          errorLimit: fetchResult.errorLimit,
          cache: fetchResult.cache,
        });

        writeProgressLine(progressLine, { final: processed === totalTypes });

        const cachedUntilTarget = resolveCachedUntil(fetchResult.cache, REFRESH_CACHE_WINDOW_MINUTES);

        summary.push({
          typeId,
          source,
          attempted,
          missing: missingCount,
          inserted,
          skipped,
          existing: existingDates.size,
          latest: latestIso,
          cache: fetchResult.cache,
          rateLimit: fetchResult.rateLimit,
          errorLimit: fetchResult.errorLimit,
          status,
          durationMs,
          ...(options.dryRun ? { message: "dry run" } : {})
        });

        const checkedAt = new Date();
        await upsertRefreshCacheEntry(pool, typeId, options.regionId, cachedUntilTarget, checkedAt);

        if (source === "esi") {
          await applyAdaptiveThrottling(fetchResult.rateLimit, fetchResult.errorLimit, typeId);
        }
      } catch (error) {
        const durationMs = Date.now() - typeStartedAt;
        flushProgressLine();
        console.error(`Failed to ingest type ${typeId}:`, error);
        summary.push({
          typeId,
          source: fixtureMap ? "fixture" : "esi",
          attempted: 0,
          missing: 0,
          inserted: 0,
          skipped: 0,
          existing: 0,
          latest: null,
          cache: createEmptyCacheHeaders(),
          rateLimit: createEmptyRateLimitHeaders(),
          errorLimit: createEmptyErrorLimitHeaders(),
          status: "error",
          message: error instanceof Error ? error.message : String(error),
          durationMs
        });
      }
    }

    const completedAt = Date.now();
    const totalDurationMs = completedAt - startedAt;
    const totals = summary.reduce((acc, entry) => {
      acc.inserted += entry.inserted;
      acc.skipped += entry.skipped;
      acc.missing += entry.missing;
      if (entry.status === "error") {
        acc.errors += 1;
      }
      return acc;
    }, { inserted: 0, skipped: 0, missing: 0, errors: 0 });

    const failureEntries = summary.filter((entry) => entry.status === "error");
    await persistFailureReport(failureEntries, {
      regionId: options.regionId,
      days: options.days,
      dryRun: options.dryRun,
      startedAt,
      completedAt,
    });

    console.info(JSON.stringify({
      regionId: options.regionId,
      days: options.days,
      dryRun: options.dryRun,
      processedTypes: summary.length,
      totals,
      durationMs: totalDurationMs,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
      entries: summary
    }, null, 2));

    await persistHistoryMetrics(summary, {
      regionId: options.regionId,
      totals,
      durationMs: totalDurationMs
    });
  } finally {
    await pool.end();
  }
}

const mainArg = process.argv[1];
const isMainModule = typeof mainArg === "string" && import.meta.url === pathToFileURL(resolve(mainArg)).href;

export const __internal = {
  loadTypeIdsFromSource,
  applyAdaptiveThrottling,
  fetchEligibleTypeIds,
  buildProgressLine,
  dedupeTypeIds,
};

if (isMainModule) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
