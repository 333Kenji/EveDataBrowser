import { z } from 'zod';
import { buildApiUrl } from './api-base';

const datasetSchema = z.object({
  label: z.string(),
  status: z.string().optional(),
  regionId: z.number().optional(),
});

const latestRunSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    schemaHash: z.string().nullable(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    durationMs: z.number().nullable(),
    errorCount: z.number().nullable(),
    warningCount: z.number().nullable(),
    lagSeconds: z.number().nullable(),
    datasets: z.array(datasetSchema),
  })
  .nullable();

const metricsResponseSchema = z.object({
  generatedAt: z.string(),
  cache: z.object({
    hits: z.number(),
    misses: z.number(),
    hitRate: z.number(),
    lastInvalidatedAt: z.string().nullable(),
    lastInvalidatedMsAgo: z.number().nullable(),
  }),
  requests: z.object({
    totalRequests: z.number(),
    errorCount: z.number(),
    averageDurationMs: z.number(),
    maxDurationMs: z.number(),
  }),
  schema: z.object({
    hash: z.string(),
    generatedAt: z.string(),
  }),
  ingestion: z.object({
    latestRun: latestRunSchema,
    note: z.string().optional(),
  }),
});

export type MetricsSnapshot = z.infer<typeof metricsResponseSchema>;

export async function fetchMetricsSnapshot(): Promise<MetricsSnapshot> {
  const url = buildApiUrl('/v1/internal/metrics');
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load metrics: ${response.status}`);
  }

  const payload = await response.json();
  return metricsResponseSchema.parse(payload);
}
