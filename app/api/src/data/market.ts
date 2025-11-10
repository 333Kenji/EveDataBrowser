import type { Pool } from "pg";
import {
  createPostgresMarketRepository,
  type MarketHistoryPoint,
  type MarketLatestStatsSummary,
  type MarketRepository,
} from "@evedatabrowser/contracts";
import { resolveCacheEnvelope, type CacheEnvelope, type CacheOptions } from "./shared.js";
import schemaManifest from "../../../../persistence/manifests/schema-manifest.json" with { type: "json" };

type MarketOrderDirection = "asc" | "desc";

export interface MarketHistoryRequest {
  typeId: number;
  regionId: number;
  limit?: number;
  order?: MarketOrderDirection;
  startDate?: string;
  endDate?: string;
}

export interface MarketLatestStatsRequest {
  typeId: number;
  regionId: number;
}

export interface MarketDataOptions {
  refresh?: boolean;
  cache?: CacheOptions;
}

export interface MarketHistoryResult {
  data: MarketHistoryPoint[];
  cache: CacheEnvelope;
  schemaHash: string;
}

export interface MarketLatestStatsResult {
  data: MarketLatestStatsSummary | null;
  cache: CacheEnvelope;
  schemaHash: string;
}

const SCHEMA_HASH = typeof schemaManifest?.schemaHash === "string"
  ? schemaManifest.schemaHash
  : "unknown";

const DEFAULT_CACHE: CacheEnvelope = {
  scope: "public",
  maxAgeSeconds: 300,
  staleWhileRevalidateSeconds: 120,
  generatedAt: new Date(0),
};

type RepositoryCache = WeakMap<Pool, MarketRepository>;
const repositoryCache: RepositoryCache = new WeakMap();

function getRepository(pool: Pool): MarketRepository {
  const existing = repositoryCache.get(pool);
  if (existing) {
    return existing;
  }
  const created = createPostgresMarketRepository(pool);
  repositoryCache.set(pool, created);
  return created;
}

export async function getMarketHistory(
  pool: Pool,
  request: MarketHistoryRequest,
  options: MarketDataOptions = {},
): Promise<MarketHistoryResult> {
  const repository = getRepository(pool);
  const history = await repository.getHistory({
    typeId: request.typeId,
    regionId: request.regionId,
    limit: request.limit,
    order: request.order,
    startDate: request.startDate,
    endDate: request.endDate,
  });

  const normalizedHistory: MarketHistoryPoint[] = Array.isArray(history)
    ? [...history]
    : [];

  return {
    data: normalizedHistory,
    cache: resolveCacheEnvelope(options.cache, DEFAULT_CACHE),
    schemaHash: SCHEMA_HASH,
  } satisfies MarketHistoryResult;
}

export async function getMarketLatestStats(
  pool: Pool,
  request: MarketLatestStatsRequest,
  options: MarketDataOptions = {},
): Promise<MarketLatestStatsResult> {
  const repository = getRepository(pool);
  const stats = await repository.getLatestStats({
    typeId: request.typeId,
    regionId: request.regionId,
  });

  return {
    data: stats,
    cache: resolveCacheEnvelope(options.cache, DEFAULT_CACHE),
    schemaHash: SCHEMA_HASH,
  } satisfies MarketLatestStatsResult;
}
