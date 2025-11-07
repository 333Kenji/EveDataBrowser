import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MarketHistoryChart } from './MarketHistoryChart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Provide store context mock (zustand store imported inside component). If store has defaults we can rely on them.

// Mock fetch to return deterministic data with a couple of days and volumes so ticks render.
const buildHistoryResponse = () => ({
  data: [
    {
      typeId: 34,
      regionId: 10000002,
      bucketStart: '2025-10-03T00:00:00Z',
      averagePrice: 100,
      highPrice: 111,
      lowPrice: 95,
      medianPrice: 105,
      volume: 1000,
      orderCount: 20,
      source: 'test-suite',
      lastIngestedAt: '2025-10-04T00:00:00Z',
    },
    {
      typeId: 34,
      regionId: 10000002,
      bucketStart: '2025-10-04T00:00:00Z',
      averagePrice: 101,
      highPrice: 112,
      lowPrice: 96,
      medianPrice: 106,
      volume: 1200,
      orderCount: 18,
      source: 'test-suite',
      lastIngestedAt: '2025-10-05T00:00:00Z',
    },
  ],
  meta: { schemaHash: 'ticks-test-history' },
});

const buildSnapshotResponse = () => ({
  data: {
    typeId: 34,
    regionId: 10000002,
    lastSeenAt: '2025-10-04T00:00:00Z',
    snapshotLow: 101,
    snapshotHigh: 111,
    snapshotMedian: 106,
    snapshotVolume: 550,
    source: 'test-suite',
    updatedAt: '2025-10-04T00:00:00Z',
  },
  meta: { schemaHash: 'ticks-test-latest' },
});

const mockFetch = vi.fn(async (url: string) => {
  if (/\/v1\/market\/history/.test(url)) {
    return new Response(JSON.stringify(buildHistoryResponse()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (/\/v1\/market\/latest/.test(url)) {
    return new Response(JSON.stringify(buildSnapshotResponse()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('not found', { status: 404 });
});

describe('MarketHistoryChart volume ticks', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // @ts-ignore override global fetch
    global.fetch = mockFetch;
  });

  it('renders one short tick marker per volume tick (no duplication or ghosting)', async () => {
    const qc = new QueryClient();
    const { getByTestId, queryAllByTestId } = render(
      <QueryClientProvider client={qc}>
        <MarketHistoryChart typeId="34" />
      </QueryClientProvider>
    );
    // Wait for root to have svg rendered
    await waitFor(() => getByTestId('market-history-svg'));
    // Ensure fetch happened
    expect(mockFetch).toHaveBeenCalled();

    // All tick rows
    const rows = queryAllByTestId('volume-tick-row');
    const shortTicks = queryAllByTestId('volume-tick-short');

    // Invariant: exactly one short tick per row
    expect(shortTicks.length).toBe(rows.length);

    // Ensure we did not accidentally draw duplicate 0-line outside of baseline.
    // Baseline exists separately; zero volume row should have only its short tick and NO horizontal guide.
    // We assert that among rows with v==0 (first row expected), there is no child line with data-guide-zero attr.
    // (Not adding extra data attr; rely on implementation: horizontal guide lines have no data-testid.)
    // Count horizontal guides by selecting lines inside rows excluding short tick markers.
    const horizontalGuides = rows.flatMap(r => Array.from(r.querySelectorAll('line')).filter(l => !l.getAttribute('data-testid')));
    // Should be less than total rows (because zero row skipped). Cheap heuristic: guides <= rows.length - 1
    expect(horizontalGuides.length).toBeLessThanOrEqual(rows.length - 1);
  });
});
