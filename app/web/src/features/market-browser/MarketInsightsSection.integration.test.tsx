import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketInsightsSection } from '../../components/ItemDetail/MarketInsightsSection';

const originalFetch = global.fetch;

type MockResponse = { ok?: boolean; json?: any; error?: number } | Error;

function setupFetchMock(sequence: MockResponse[]) {
  let call = 0;
  (global as any).fetch = vi.fn(async () => {
    const idx = Math.min(call, sequence.length - 1);
    call += 1;
    const entry = sequence[idx];
    if (entry instanceof Error) {
      throw entry;
    }
    const ok = entry.ok !== false && !entry.error;
    return {
      ok,
      status: entry.error ?? 200,
      json: async () => entry.json,
    } as any;
  });
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

describe('MarketInsightsSection integration', () => {
  beforeEach(() => {
    (global as any).fetch = originalFetch;
  });

  it('renders snapshot metrics and history chart when data is available', async () => {
    setupFetchMock([
      {
        json: {
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
          meta: { schemaHash: 'integration-hash' },
        },
      },
      {
        json: {
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
          meta: { schemaHash: 'integration-latest' },
        },
      },
    ]);

    const client = createClient();
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
    setupFetchMock([
      { ok: false, error: 500, json: { message: 'history failed' } },
      { ok: false, error: 500, json: { message: 'snapshot failed' } },
    ]);

    const client = createClient();
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
