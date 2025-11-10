import { z } from 'zod';
import { buildApiUrl } from './api-base';

const structureOrderSchema = z.object({
  structureId: z.number().int(),
  orderId: z.number().int(),
  typeId: z.number().int(),
  isBuyOrder: z.boolean(),
  price: z.number(),
  volumeRemain: z.number().int(),
  issuedAt: z.string(),
  lastUpdatedAt: z.string(),
});

const cacheEnvelopeSchema = z.object({
  scope: z.enum(['public', 'private']),
  maxAgeSeconds: z.number().int(),
  staleWhileRevalidateSeconds: z.number().int().optional(),
  generatedAt: z.string(),
});

const structureOrdersResponseSchema = z.object({
  data: z.array(structureOrderSchema),
  cache: cacheEnvelopeSchema,
  schemaHash: z.string(),
});

export type StructureOrder = z.infer<typeof structureOrderSchema>;

export interface CacheSummary {
  scope: 'public' | 'private';
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  generatedAt: string;
}

export interface StructureOrdersResponse {
  data: StructureOrder[];
  cache: CacheSummary;
  schemaHash: string;
}

export interface FetchStructureOrdersOptions {
  typeId?: number | null;
  refresh?: boolean;
  signal?: AbortSignal;
}

const STRUCTURE_CACHE_DEFAULTS: CacheSummary = {
  scope: 'private',
  maxAgeSeconds: 120,
  staleWhileRevalidateSeconds: 60,
  generatedAt: new Date(0).toISOString(),
};

function normalizeCacheEnvelope(input?: z.infer<typeof cacheEnvelopeSchema>): CacheSummary {
  if (!input) {
    return {
      ...STRUCTURE_CACHE_DEFAULTS,
      generatedAt: new Date().toISOString(),
    };
  }

  const maxAgeSeconds = Number.isFinite(input.maxAgeSeconds) ? input.maxAgeSeconds : STRUCTURE_CACHE_DEFAULTS.maxAgeSeconds;
  const staleWhileRevalidateSeconds = Number.isFinite(input.staleWhileRevalidateSeconds)
    ? input.staleWhileRevalidateSeconds ?? STRUCTURE_CACHE_DEFAULTS.staleWhileRevalidateSeconds
    : STRUCTURE_CACHE_DEFAULTS.staleWhileRevalidateSeconds;
  const parsedGeneratedAt = Date.parse(input.generatedAt ?? '');
  const generatedAt = Number.isFinite(parsedGeneratedAt)
    ? new Date(parsedGeneratedAt).toISOString()
    : new Date().toISOString();

  return {
    scope: input.scope === 'public' ? 'public' : 'private',
    maxAgeSeconds,
    staleWhileRevalidateSeconds,
    generatedAt,
  };
}

export async function fetchStructureOrders(
  structureId: number,
  options: FetchStructureOrdersOptions = {},
): Promise<StructureOrdersResponse> {
  if (!Number.isFinite(structureId) || structureId <= 0) {
    throw new Error('structureId must be a positive integer');
  }

  const params: Record<string, string | number | undefined> = {};

  if (options.refresh) {
    params.refresh = 1;
  }

  if (Number.isFinite(options.typeId) && options.typeId && options.typeId > 0) {
    params.typeId = Math.trunc(options.typeId);
  }

  const url = buildApiUrl(`/v1/market/structures/${structureId}/orders`, params);
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`structure orders request failed (${response.status})`);
  }

  const payload = structureOrdersResponseSchema.parse(await response.json());
  return {
    data: payload.data,
    cache: normalizeCacheEnvelope(payload.cache),
    schemaHash: payload.schemaHash,
  };
}
