import { describe, expect, it, afterEach, vi } from 'vitest';
import { fetchMarketHistory } from '../market-history-client';

vi.mock('../api-base', () => ({
  resolveApiBases: () => ['https://primary.test'],
  buildApiUrl: (path: string, params: Record<string, unknown>, base?: string) => {
    const url = new URL(path, base ?? 'https://primary.test');
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  },
}));

const historyPayload = {
  data: [
    {
      typeId: 603,
      regionId: 10000002,
      bucketStart: '2025-10-13T00:00:00.000Z',
      averagePrice: 2850000.45,
      highPrice: 3300000.88,
      lowPrice: 2700000.33,
      medianPrice: 2950000.12,
      volume: 48,
      orderCount: 14,
      source: 'postgres',
      lastIngestedAt: '2025-10-13T08:00:00.000Z',
    },
    {
      typeId: 603,
      regionId: 10000002,
      bucketStart: '2025-10-12T00:00:00.000Z',
      averagePrice: 2800000.15,
      highPrice: 3200000.44,
      lowPrice: 2600000.12,
      medianPrice: 2900000.65,
      volume: 42,
      orderCount: 12,
      source: 'postgres',
      lastIngestedAt: '2025-10-13T08:00:00.000Z',
    },
  ],
  cache: {
    scope: 'public',
    maxAgeSeconds: 300,
    staleWhileRevalidateSeconds: 120,
    generatedAt: '2025-10-13T10:10:00.000Z',
  },
  schemaHash: 'history-hash',
};

const snapshotPayload = {
  data: {
    typeId: 603,
    regionId: 10000002,
    lastSeenAt: '2025-10-13T08:00:00.000Z',
    snapshotLow: 2500000.11,
    snapshotHigh: 3400000.99,
    snapshotMedian: 2950000.23,
    snapshotVolume: 50,
    source: 'postgres',
    updatedAt: '2025-10-13T08:05:00.000Z',
  },
  },
  cache: {
    scope: 'public',
    maxAgeSeconds: 300,
    staleWhileRevalidateSeconds: 120,
    generatedAt: '2025-10-13T10:12:00.000Z',
  },
  schemaHash: 'latest-hash',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('fetchMarketHistory', () => {
  it('returns snapshot schema hash when available', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => historyPayload,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => snapshotPayload,
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMarketHistory('603');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.dataVersion).toBe('latest-hash');
    expect(result.snapshot).toEqual(snapshotPayload.data);
    expect(result.typeId).toBe(603);
    expect(result.regionId).toBe(10000002);
    expect(result.cache).toEqual({
      scope: 'public',
      maxAgeSeconds: 300,
      staleWhileRevalidateSeconds: 120,
      generatedAt: '2025-10-13T10:10:00.000Z',
    });
    expect(result.schemaHash).toBe('latest-hash');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.days.map((bucket) => bucket.bucketStart)).toEqual([
      '2025-10-12T00:00:00.000Z',
      '2025-10-13T00:00:00.000Z',
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://primary.test/v1/market/history?typeId=603&regionId=10000002&limit=90&order=desc',
      { headers: { Accept: 'application/json' } },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://primary.test/v1/market/latest?typeId=603&regionId=10000002',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('returns schema hash from 404 payload without hitting latest', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        schemaHash: 'not-found-hash',
        cache: {
          scope: 'public',
          maxAgeSeconds: 300,
          staleWhileRevalidateSeconds: 120,
          generatedAt: '2025-10-13T10:15:00.000Z',
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMarketHistory('603', { refresh: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.days).toEqual([]);
    expect(result.snapshot).toBeUndefined();
    expect(result.dataVersion).toBe('not-found-hash');
    expect(result.schemaHash).toBe('not-found-hash');
    expect(result.cache.generatedAt).toBe('2025-10-13T10:15:00.000Z');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://primary.test/v1/market/history?typeId=603&regionId=10000002&limit=90&order=desc&refresh=1',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('passes through explicit limit when provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => historyPayload,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => snapshotPayload,
      });

    vi.stubGlobal('fetch', fetchMock);

    await fetchMarketHistory('603', { limit: 42 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://primary.test/v1/market/history?typeId=603&regionId=10000002&limit=42&order=desc',
      { headers: { Accept: 'application/json' } },
    );
  });
});
