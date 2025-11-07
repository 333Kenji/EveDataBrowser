import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { MarketHistoryChart, useUnifiedMarketModel } from '../../features/market-browser/MarketHistoryChart';
import { CanvasMarketHistoryChart } from '../../features/market-browser/CanvasMarketHistoryChart';

const mockUseUnifiedMarketModel = vi.mocked(useUnifiedMarketModel);
const mockMarketHistoryChart = vi.mocked(MarketHistoryChart);
const mockCanvasMarketHistoryChart = vi.mocked(CanvasMarketHistoryChart);

describe('MarketInsightsSection', () => {
  beforeEach(() => {
    mockUseUnifiedMarketModel.mockReset();
    mockMarketHistoryChart.mockClear();
    mockCanvasMarketHistoryChart.mockClear();
  });

  it('shows loading banner and renders chart while data fetch is pending', () => {
    mockUseUnifiedMarketModel.mockReturnValue({
      status: 'loading',
      model: { snapshot: undefined },
      error: undefined,
      refetch: vi.fn(),
    });

    render(<MarketInsightsSection typeId="603" />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading market data/i);
    const call = mockMarketHistoryChart.mock.calls[0]?.[0];
    expect(call).toMatchObject({ typeId: '603' });
    expect(call.prefetchedQuery).toBeDefined();
  });

  it('renders snapshot values and chart when data is available', () => {
    mockUseUnifiedMarketModel.mockReturnValue({
      status: 'ok',
      model: {
        snapshot: {
          source: 'postgres',
          buy: { price: 150_000_000, changePct: 1.25, volume: 42 },
          sell: { price: 152_000_000, changePct: -0.5, volume: 38 },
        },
      },
      error: undefined,
      refetch: vi.fn(),
    });

    render(<MarketInsightsSection typeId="603" headingLevel="h4" />);

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent(/market activity/i);
    expect(screen.getByText(/150,000,000/)).toBeInTheDocument();
    expect(screen.getByText(/152,000,000/)).toBeInTheDocument();
    expect(mockMarketHistoryChart).toHaveBeenCalledTimes(1);
  });

  it('exposes retry control when market data fails', () => {
    const refetch = vi.fn();
    mockUseUnifiedMarketModel.mockReturnValue({
      status: 'error',
      model: { snapshot: undefined },
      error: new Error('timeout'),
      refetch,
    });

    render(<MarketInsightsSection typeId="603" />);

    const retry = screen.getByRole('button', { name: /retry/i });
    expect(retry).toBeInTheDocument();
    retry.click();
    expect(refetch).toHaveBeenCalled();
  });

  it('renders experimental canvas when requested', () => {
    mockUseUnifiedMarketModel.mockReturnValue({
      status: 'ok',
      model: { snapshot: undefined },
      error: undefined,
      refetch: vi.fn(),
    });

    render(<MarketInsightsSection typeId="603" experimentalCanvas />);

    expect(mockCanvasMarketHistoryChart).toHaveBeenCalled();
    expect(screen.getByText(/experimental canvas renderer prototype/i)).toBeInTheDocument();
  });
});
