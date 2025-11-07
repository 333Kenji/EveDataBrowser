import { z } from 'zod';
import {
  MarketHistoryPointSchema,
  MarketLatestStatsSummarySchema,
  MARKET_HISTORY_DEFAULT_LIMIT,
} from '@evedatabrowser/contracts';
import { buildApiUrl, resolveApiBases } from './api-base';

const historyResponseSchema = z.object({
  data: z.array(MarketHistoryPointSchema),
  meta: z
    .object({
      schemaHash: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

const latestResponseSchema = z.object({
  data: MarketLatestStatsSummarySchema,
  meta: z
    .object({
      schemaHash: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export interface MarketHistoryApiResponse {
  typeId: number;
  regionId: number;
  days: z.infer<typeof MarketHistoryPointSchema>[];
  snapshot?: z.infer<typeof MarketLatestStatsSummarySchema>;
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
        try {
          const notFoundJson = await historyResponse.json();
          if (notFoundJson?.meta?.schemaHash) {
            schemaHash = String(notFoundJson.meta.schemaHash);
          }
        } catch {
          // ignore JSON parsing issues on 404 responses
        }

        return {
          typeId: Number(typeId),
          regionId,
          days: [],
          snapshot: undefined,
          dataVersion: schemaHash,
          latencyMs: Math.max(0, nowMs() - start),
        } satisfies MarketHistoryApiResponse;
      }

      if (!historyResponse.ok) {
        lastError = new Error(`market history request failed (${historyResponse.status})`);
        continue;
      }

      const historyJson = historyResponseSchema.parse(await historyResponse.json());

      const sortedHistory = [...historyJson.data].sort((a, b) => {
        const aTime = Date.parse(a.bucketStart);
        const bTime = Date.parse(b.bucketStart);
        return Number.isFinite(aTime) && Number.isFinite(bTime)
          ? aTime - bTime
          : a.bucketStart.localeCompare(b.bucketStart);
      });

      let snapshot;
      let schemaHash = historyJson.meta?.schemaHash ?? 'unknown';

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
          schemaHash = latestJson.meta?.schemaHash ?? schemaHash;
        }
      } catch (snapshotError) {
        console.warn('[market-history] snapshot request failed', snapshotError);
      }

      return {
        typeId: Number(typeId),
        regionId,
  days: sortedHistory,
        snapshot,
        dataVersion: schemaHash,
        latencyMs: Math.max(0, nowMs() - start),
      } satisfies MarketHistoryApiResponse;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to load market history');
}
