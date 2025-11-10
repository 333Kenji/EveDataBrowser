import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketInsightsSection } from './MarketInsightsSection';

vi.mock('../../features/market-browser/MarketHistoryChart', () => {
  const MarketHistoryChartMock = vi.fn(() => <div data-testid="market-chart" />);
  const useUnifiedMarketModelMock = vi.fn();
  return {
    MarketHistoryChart: MarketHistoryChartMock,
    useUnifiedMarketModel: useUnifiedMarketModelMock,
  };
});

vi.mock('../../features/market-browser/CanvasMarketHistoryChart', () => ({
  CanvasMarketHistoryChart: vi.fn(() => <div data-testid="canvas-chart" />),
}));

// Import after mocks so vi.mocked resolves correctly
import { CanvasMarketHistoryChart } from '../../features/market-browser/CanvasMarketHistoryChart';

const mockUseUnifiedMarketModel = vi.mocked(useUnifiedMarketModel);
const mockMarketHistoryChart = vi.mocked(MarketHistoryChart);
const mockCanvasMarketHistoryChart = vi.mocked(CanvasMarketHistoryChart);

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      cacheTime: 0
    }
  }
});

function renderWithProviders(ui: React.ReactElement) {
  const client = createQueryClient();
  return {
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
    client
  };
}

const defaultQaPayload = {
  ok: true,
  report: {
    generatedAt: '2025-10-13T10:00:00Z',
    lookbackDays: 30,
    missingDays: [],
    duplicateBuckets: [],
    staleLatest: []
  },
  hasIssues: false
};

const defaultFeaturesPayload = { features: { structureOrders: { enabled: false, structures: [] } } };

const defaultFetchImplementation = async (input: string | Request) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.includes('/v1/internal/market-qa')) {
    return {
      ok: true,
      json: async () => defaultQaPayload
    };
  }
  if (url.includes('/v1/internal/features')) {
    return {
      ok: true,
      json: async () => defaultFeaturesPayload
    };
  }
  return {
    ok: true,
    json: async () => ({})
  };
};

const mockInternalFetch = vi.fn(defaultFetchImplementation);

type MockQuery = {
  status: 'loading' | 'error' | 'empty' | 'partial' | 'ok';
  model: { snapshot?: unknown };
  error?: Error;
  refetch: ReturnType<typeof vi.fn>;
  cache?: unknown;
  schemaHash?: string;
  requestRefresh: () => void;
  isFetching: boolean;
};

const buildQuery = (overrides: Partial<MockQuery> = {}): MockQuery => ({
  status: 'loading',
  model: { snapshot: undefined },
  error: undefined,
  refetch: vi.fn(),
  cache: undefined,
  schemaHash: undefined,
  requestRefresh: vi.fn(),
  isFetching: false,
  ...overrides,
});

describe('MarketInsightsSection', () => {
  beforeEach(() => {
    mockUseUnifiedMarketModel.mockReset();
    mockMarketHistoryChart.mockClear();
    mockCanvasMarketHistoryChart.mockClear();
    mockInternalFetch.mockReset();
    mockInternalFetch.mockImplementation(defaultFetchImplementation);
    vi.stubGlobal('fetch', mockInternalFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows loading banner and renders chart while data fetch is pending', () => {
    mockUseUnifiedMarketModel.mockReturnValue(buildQuery({
      status: 'loading',
    }));

    renderWithProviders(<MarketInsightsSection typeId="603" />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading market data/i);
    const call = mockMarketHistoryChart.mock.calls[0]?.[0];
    expect(call).toMatchObject({ typeId: '603' });
    expect(call.prefetchedQuery).toBeDefined();
  });

  it('renders snapshot values and chart when data is available', () => {
    mockUseUnifiedMarketModel.mockReturnValue(buildQuery({
      status: 'ok',
      model: {
        snapshot: {
          source: 'postgres',
          buy: { price: 150_000_000, changePct: 1.25, volume: 42 },
          sell: { price: 152_000_000, changePct: -0.5, volume: 38 },
        },
      },
    }));

    renderWithProviders(<MarketInsightsSection typeId="603" headingLevel="h4" />);

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent(/market activity/i);
    expect(screen.getByText(/150,000,000/)).toBeInTheDocument();
    expect(screen.getByText(/152,000,000/)).toBeInTheDocument();
    expect(mockMarketHistoryChart).toHaveBeenCalledTimes(1);
  });

  it('exposes retry control when market data fails', () => {
    const refetch = vi.fn();
    mockUseUnifiedMarketModel.mockReturnValue(buildQuery({
      status: 'error',
      model: { snapshot: undefined },
      error: new Error('timeout'),
      refetch,
    }));

    renderWithProviders(<MarketInsightsSection typeId="603" />);

    const retry = screen.getByRole('button', { name: /retry/i });
    expect(retry).toBeInTheDocument();
    retry.click();
    expect(refetch).toHaveBeenCalled();
  });

  it('renders experimental canvas when requested', async () => {
    mockUseUnifiedMarketModel.mockReturnValue(buildQuery({
      status: 'ok',
    }));

    renderWithProviders(<MarketInsightsSection typeId="603" experimentalCanvas />);

    await screen.findByTestId('canvas-chart');
    expect(mockCanvasMarketHistoryChart).toHaveBeenCalled();
    expect(screen.getByText(/experimental canvas renderer prototype/i)).toBeInTheDocument();
  });

  it('renders structure orders panel when feature flag enabled', async () => {
    mockUseUnifiedMarketModel.mockReturnValue(buildQuery({
      status: 'ok',
    }));

    mockInternalFetch.mockImplementation(async (input: string | Request) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/v1/internal/features')) {
        return {
          ok: true,
          json: async () => ({ features: { structureOrders: { enabled: true, structures: [60003760] } } })
        };
      }
      if (url.includes('/v1/market/structures/60003760/orders')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                structureId: 60003760,
                orderId: 1,
                typeId: 603,
                isBuyOrder: false,
                price: 125_000_000,
                volumeRemain: 5,
                issuedAt: '2025-10-10T00:00:00Z',
                lastUpdatedAt: '2025-10-10T01:00:00Z'
              },
              {
                structureId: 60003760,
                orderId: 2,
                typeId: 603,
                isBuyOrder: true,
                price: 120_000_000,
                volumeRemain: 3,
                issuedAt: '2025-10-10T02:00:00Z',
                lastUpdatedAt: '2025-10-10T02:30:00Z'
              }
            ],
            cache: {
              scope: 'private',
              maxAgeSeconds: 120,
              staleWhileRevalidateSeconds: 60,
              generatedAt: '2025-10-13T10:00:00Z'
            },
            schemaHash: 'test-hash'
          })
        };
      }
      return defaultFetchImplementation(input);
    });

    renderWithProviders(<MarketInsightsSection typeId="603" />);

    await screen.findByText(/private structure orders/i);
    expect(screen.getByText(/Structure 60,003,760/)).toBeInTheDocument();
    expect(screen.queryByText(/No buy orders/i)).not.toBeInTheDocument();
    expect(screen.getByText(/125\.00M/)).toBeInTheDocument();
  });
});
