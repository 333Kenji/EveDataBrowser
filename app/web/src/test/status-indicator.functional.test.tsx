import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusIndicator } from '../components/StatusIndicator/StatusIndicator';

function renderStatusIndicator() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StatusIndicator />
    </QueryClientProvider>,
  );
}

function buildMetricsPayload() {
  return {
    generatedAt: '2025-10-15T12:34:56.000Z',
    cache: {
      hits: 10,
      misses: 2,
      hitRate: 0.8333,
      lastInvalidatedAt: null,
      lastInvalidatedMsAgo: null,
    },
    requests: {
      totalRequests: 4,
      errorCount: 0,
      averageDurationMs: 12.4,
      maxDurationMs: 25.1,
    },
    schema: {
      hash: 'e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac',
      generatedAt: '2025-10-13T00:45:00Z',
    },
    ingestion: {
      latestRun: null,
      note: 'No ingestion sample available',
    },
  };
}

describe('StatusIndicator', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders healthy message when API responds with healthy overallStatus', async () => {
    const fetchMock = fetch as unknown as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/ping')) {
        return { ok: true, json: async () => ({}) } as any;
      }
      if (url.includes('/v1/internal/metrics')) {
        return { ok: true, json: async () => buildMetricsPayload() } as any;
      }
      // Fallback for health endpoint (should be skipped when ping succeeds)
      return { ok: true, json: async () => ({ overallStatus: 'healthy' }) } as any;
    });

    renderStatusIndicator();

    await waitFor(() => {
      const el = screen.getByText(/Systems stable/i);
      expect(el).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/ping$/), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/internal\/metrics$/), expect.any(Object));
  });

  it('renders offline guidance when fetch fails', async () => {
    const fetchMock = fetch as unknown as Mock;
    fetchMock.mockImplementation(async () => {
      throw new Error('network down');
    });

    renderStatusIndicator();

    await waitFor(() => {
      const offlineEl = screen.getByText(/Connectivity issue detected/i);
      expect(offlineEl).toBeTruthy();
    });

    expect(screen.getByText(/Unable to reach API/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Quickstart/i });
    expect(link.getAttribute('href')).toBe('/quickstart');
  });

  it('surfaces metrics error copy when the metrics endpoint fails', async () => {
    const fetchMock = fetch as unknown as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/ping')) {
        return { ok: true, json: async () => ({}) } as any;
      }
      if (url.includes('/v1/internal/metrics')) {
        return { ok: false, status: 503, json: async () => ({ message: 'down' }) } as any;
      }
      return { ok: true, json: async () => ({ overallStatus: 'healthy' }) } as any;
    });

    renderStatusIndicator();

    await waitFor(() => expect(screen.getByText(/Systems stable/i)).toBeVisible());
    expect(screen.getByText(/Cache metrics unavailable/i)).toBeVisible();
    expect(screen.getByText(/Request metrics unavailable/i)).toBeVisible();
    expect(screen.getByText(/Ingestion metrics unavailable/i)).toBeVisible();
  });
});
