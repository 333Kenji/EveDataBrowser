import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketInsightsSection } from '../../components/ItemDetail/MarketInsightsSection';

const originalFetch = global.fetch;

const HISTORY_CACHE = {
  scope: 'public',
  maxAgeSeconds: 300,
  staleWhileRevalidateSeconds: 120,
  generatedAt: '2025-10-01T12:00:00.000Z',
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

function createFeatureResponse(enabled = false, structures: number[] = []) {
  return { features: { structureOrders: { enabled, structures } } };
}

function createMarketQaResponse() {
  return {
    ok: true,
    report: {
      generatedAt: '2025-10-01T12:00:00Z',
      lookbackDays: 30,
      missingDays: [],
      duplicateBuckets: [],
      staleLatest: [],
    },
    hasIssues: false,
  };
}

function createFetchMock(responses: {
  history?: unknown;
  latest?: unknown;
  historyError?: number;
  latestError?: number;
}) {
  (global as any).fetch = vi.fn(async (input: string | Request) => {
    const url = typeof input === 'string' ? input : input.url || input.toString();
    if (/\/v1\/market\/history/.test(url)) {
      if (responses.historyError) {
        return {
          ok: false,
          status: responses.historyError,
          json: async () => ({ message: 'history failed' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => responses.history,
      };
    }
    if (/\/v1\/market\/latest/.test(url)) {
      if (responses.latestError) {
        return {
          ok: false,
          status: responses.latestError,
          json: async () => ({ message: 'snapshot failed' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => responses.latest,
      };
    }
    if (/\/v1\/internal\/market-qa/.test(url)) {
      return {
        ok: true,
        status: 200,
        json: async () => createMarketQaResponse(),
      };
    }
    if (/\/v1\/internal\/features/.test(url)) {
      return {
        ok: true,
        status: 200,
        json: async () => createFeatureResponse(false),
      };
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ message: 'not found' }),
    };
  });
}

describe('MarketInsightsSection integration', () => {
  beforeEach(() => {
    (global as any).fetch = originalFetch;
  });

  it('renders snapshot metrics and history chart when data is available', async () => {
    createFetchMock({
      history: {
        data: [
          {
            typeId: 603,
            regionId: 10000002,
            bucketStart: '2025-10-01T00:00:00Z',
            averagePrice: 9.5,
            highPrice: 10.5,
            lowPrice: 8.9,
            medianPrice: 9.9,
            volume: 42,
            orderCount: 3,
            source: 'integration-test',
            lastIngestedAt: '2025-10-01T12:10:00Z',
          },
        ],
        cache: HISTORY_CACHE,
        schemaHash: 'integration-hash',
      },
      latest: {
        data: {
          typeId: 603,
          regionId: 10000002,
          lastSeenAt: '2025-10-01T12:00:00Z',
          snapshotLow: 9.1,
          snapshotHigh: 10.7,
          snapshotMedian: 9.8,
          snapshotVolume: 120,
          source: 'test',
          updatedAt: '2025-10-01T12:05:00Z',
        },
        cache: { ...HISTORY_CACHE, generatedAt: '2025-10-01T12:05:00Z' },
        schemaHash: 'integration-latest',
      },
    });

    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <MarketInsightsSection typeId="603" headingLevel="h3" />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText(/Market activity/i)).toBeVisible());

    const snapshotHeading = await screen.findByText(/Current snapshot/i);
    expect(snapshotHeading).toBeVisible();

    expect(await screen.findByText(/9\.1/)).toBeInTheDocument();
    expect(await screen.findByText(/10\.7/)).toBeInTheDocument();
  });

  it('surfaces the error banner when both history and snapshot fail', async () => {
    createFetchMock({
      historyError: 500,
      latestError: 500,
    });

    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <MarketInsightsSection typeId="999999" headingLevel="h3" />
      </QueryClientProvider>,
    );

    const alert = await waitFor(
      () => screen.getByRole('alert'),
      { timeout: 3000 },
    );
    expect(alert).toHaveTextContent(/Market data unavailable/i);
    expect(alert).toHaveTextContent(/Retry/i);
  });
});
