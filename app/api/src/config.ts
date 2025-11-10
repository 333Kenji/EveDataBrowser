import { z } from "zod";

const DEFAULT_CACHE_TAXONOMY_MAX_AGE = 3600;
const DEFAULT_CACHE_TAXONOMY_STALE = 120;
const DEFAULT_CACHE_MARKET_MAX_AGE = 300;
const DEFAULT_CACHE_MARKET_STALE = 120;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  PGHOST: z.string().optional(),
  PGPORT: z.coerce.number().int().positive().optional(),
  PGUSER: z.string().optional(),
  PGPASSWORD: z.string().optional(),
  PGDATABASE: z.string().optional(),
  PGSSLMODE: z.string().optional(),
  API_CACHE_TAXONOMY_MAX_AGE: z.coerce.number().int().nonnegative().optional(),
  API_CACHE_TAXONOMY_STALE: z.coerce.number().int().nonnegative().optional(),
  API_CACHE_ITEMS_MAX_AGE: z.coerce.number().int().nonnegative().optional(),
  API_CACHE_ITEMS_STALE: z.coerce.number().int().nonnegative().optional(),
  API_CACHE_MARKET_MAX_AGE: z.coerce.number().int().nonnegative().optional(),
  API_CACHE_MARKET_STALE: z.coerce.number().int().nonnegative().optional(),
  API_CORS_ALLOW_ORIGINS: z.string().optional(),
  FEATURE_STRUCTURE_ORDERS: z.coerce.boolean().optional(),
  STRUCTURE_ORDER_STRUCTURE_IDS: z.string().optional()
});

const env = envSchema.parse(process.env);

function buildConnectionString(): string {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const host = env.PGHOST ?? "localhost";
  const port = env.PGPORT ?? 5432;
  const user = env.PGUSER ?? "eveapp";
  const password = env.PGPASSWORD ?? "eveapp";
  const database = env.PGDATABASE ?? "eveapp";

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function sslEnabled(): boolean {
  const value = env.PGSSLMODE?.toLowerCase();
  if (!value) {
    return false;
  }

  return value !== "disable" && value !== "allow" && value !== "prefer";
}

function toCacheValue(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function resolveCorsOrigins(value: string | undefined): true | string[] {
  if (!value) {
    return true;
  }

  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0 || entries.includes("*")) {
    return true;
  }

  return entries;
}

function parseStructureIds(value: string | undefined): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((id) => Number.isFinite(id) && id > 0) as number[];
}

export const config = {
  database: {
    connectionString: buildConnectionString(),
    useSsl: sslEnabled()
  },
  server: {
    cors: {
      origin: resolveCorsOrigins(env.API_CORS_ALLOW_ORIGINS)
    }
  },
  cache: {
    taxonomy: {
      maxAge: toCacheValue(env.API_CACHE_TAXONOMY_MAX_AGE, DEFAULT_CACHE_TAXONOMY_MAX_AGE),
      staleWhileRevalidate: toCacheValue(env.API_CACHE_TAXONOMY_STALE, DEFAULT_CACHE_TAXONOMY_STALE)
    },
    items: {
      maxAge: toCacheValue(env.API_CACHE_ITEMS_MAX_AGE ?? env.API_CACHE_TAXONOMY_MAX_AGE, DEFAULT_CACHE_TAXONOMY_MAX_AGE),
      staleWhileRevalidate: toCacheValue(env.API_CACHE_ITEMS_STALE ?? env.API_CACHE_TAXONOMY_STALE, DEFAULT_CACHE_TAXONOMY_STALE)
    },
    market: {
      maxAge: toCacheValue(env.API_CACHE_MARKET_MAX_AGE, DEFAULT_CACHE_MARKET_MAX_AGE),
      staleWhileRevalidate: toCacheValue(env.API_CACHE_MARKET_STALE, DEFAULT_CACHE_MARKET_STALE)
    }
  },
  features: {
    structureOrders: Boolean(env.FEATURE_STRUCTURE_ORDERS)
  },
  structureOrders: {
    structures: parseStructureIds(env.STRUCTURE_ORDER_STRUCTURE_IDS)
  }
} as const;

export type AppConfig = typeof config;
