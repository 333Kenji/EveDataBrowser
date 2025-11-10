import { z } from 'zod';
import {
  MarketHistoryPointSchema,
  MarketLatestStatsSummarySchema,
  MARKET_HISTORY_DEFAULT_LIMIT,
  CACHE_POLICY_DEFAULTS,
} from '@evedatabrowser/contracts';
import { buildApiUrl, resolveApiBases } from './api-base';

const cacheEnvelopeSchema = z.object({
  scope: z.enum(['public', 'private']),
  maxAgeSeconds: z.number().int(),
  staleWhileRevalidateSeconds: z.number().int(),
  generatedAt: z.string(),
});
const partialCacheEnvelopeSchema = cacheEnvelopeSchema.partial();

const historyResponseSchema = z.object({
  data: z.array(MarketHistoryPointSchema),
  cache: cacheEnvelopeSchema,
  schemaHash: z.string(),
});

const latestResponseSchema = z.object({
  data: MarketLatestStatsSummarySchema,
  cache: cacheEnvelopeSchema,
  schemaHash: z.string(),
});

type CacheEnvelope = z.infer<typeof cacheEnvelopeSchema>;

interface CacheSummary {
  scope: 'public' | 'private';
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  generatedAt: string;
}

const MARKET_CACHE_DEFAULTS = CACHE_POLICY_DEFAULTS.market;

function normalizeCacheEnvelope(input?: Partial<CacheEnvelope>): CacheSummary {
  const fallbackGeneratedAt = new Date().toISOString();
  const generatedAt = typeof input?.generatedAt === 'string'
    ? new Date(input.generatedAt).toISOString()
    : fallbackGeneratedAt;
  const maxAge = Number.isFinite(input?.maxAgeSeconds)
    ? Number(input!.maxAgeSeconds)
    : MARKET_CACHE_DEFAULTS.maxAgeSeconds;
  const staleWhileRevalidate = Number.isFinite(input?.staleWhileRevalidateSeconds)
    ? Number(input!.staleWhileRevalidateSeconds)
    : (MARKET_CACHE_DEFAULTS.staleWhileRevalidateSeconds ?? 0);
  const scope = input?.scope === 'private' ? 'private' : 'public';
  return {
    scope,
    maxAgeSeconds: maxAge,
    staleWhileRevalidateSeconds: staleWhileRevalidate,
    generatedAt,
  };
}

export interface MarketHistoryApiResponse {
  typeId: number;
  regionId: number;
  days: z.infer<typeof MarketHistoryPointSchema>[];
  snapshot?: z.infer<typeof MarketLatestStatsSummarySchema>;
  cache: CacheSummary;
  schemaHash: string;
  dataVersion: string;
  latencyMs: number;
}

interface FetchMarketHistoryOptions {
  refresh?: boolean;
  regionId?: number;
  limit?: number;
  order?: 'asc' | 'desc';
}

const DEFAULT_REGION_ID = 10000002; // The Forge

function nowMs(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

export async function fetchMarketHistory(typeId: string, options: FetchMarketHistoryOptions = {}): Promise<MarketHistoryApiResponse> {
  const regionId = options.regionId ?? DEFAULT_REGION_ID;
  const candidates = resolveApiBases();
  const start = nowMs();
  let lastError: unknown;
  const limitParam = options.limit != null ? options.limit : MARKET_HISTORY_DEFAULT_LIMIT;

  for (const base of candidates) {
    try {
      const historyUrl = buildApiUrl(
        '/v1/market/history',
        {
          typeId,
          regionId,
          limit: limitParam,
          order: options.order ?? 'desc',
          refresh: options.refresh ? 1 : undefined,
        },
        base,
      );

      const historyResponse = await fetch(historyUrl, { headers: { Accept: 'application/json' } });

      if (historyResponse.status === 404) {
        let schemaHash = 'not-found';
        let cache = normalizeCacheEnvelope();
        try {
          const notFoundJson = await historyResponse.json();
          if (typeof notFoundJson?.schemaHash === 'string') {
            schemaHash = notFoundJson.schemaHash;
          }
          const parsedCache = partialCacheEnvelopeSchema.safeParse(notFoundJson?.cache);
          if (parsedCache.success) {
            cache = normalizeCacheEnvelope(parsedCache.data);
          }
        } catch {
          // ignore JSON parsing issues on 404 responses
        }

        return {
          typeId: Number(typeId),
          regionId,
          days: [],
          snapshot: undefined,
          cache,
          schemaHash,
          dataVersion: schemaHash,
          latencyMs: Math.max(0, nowMs() - start),
        } satisfies MarketHistoryApiResponse;
      }

      if (!historyResponse.ok) {
        lastError = new Error(`market history request failed (${historyResponse.status})`);
        continue;
      }

      const historyJson = historyResponseSchema.parse(await historyResponse.json());
      const historyCache = normalizeCacheEnvelope(historyJson.cache);

      const sortedHistory = [...historyJson.data].sort((a, b) => {
        const aTime = Date.parse(a.bucketStart);
        const bTime = Date.parse(b.bucketStart);
        return Number.isFinite(aTime) && Number.isFinite(bTime)
          ? aTime - bTime
          : a.bucketStart.localeCompare(b.bucketStart);
      });

      let snapshot;
      let schemaHash = historyJson.schemaHash ?? 'unknown';

      try {
        const latestUrl = buildApiUrl(
          '/v1/market/latest',
          {
            typeId,
            regionId,
            refresh: options.refresh ? 1 : undefined,
          },
          base,
        );
        const latestResponse = await fetch(latestUrl, { headers: { Accept: 'application/json' } });

        if (latestResponse.ok) {
          const latestJson = latestResponseSchema.parse(await latestResponse.json());
          snapshot = latestJson.data;
          schemaHash = latestJson.schemaHash ?? schemaHash;
        }
      } catch (snapshotError) {
        console.warn('[market-history] snapshot request failed', snapshotError);
      }

      return {
        typeId: Number(typeId),
        regionId,
  days: sortedHistory,
        snapshot,
        cache: historyCache,
        schemaHash,
        dataVersion: schemaHash,
        latencyMs: Math.max(0, nowMs() - start),
      } satisfies MarketHistoryApiResponse;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to load market history');
}
