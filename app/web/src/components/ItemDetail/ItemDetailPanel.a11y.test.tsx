import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemDetailPanel } from '../../features/market-browser/ItemDetailPanel';
import { useMarketBrowserStore } from '../../features/market-browser/marketBrowserStore';

const baseDetail = {
  typeId: 'atr',
  name: 'Atron',
  category: 'Ships',
  group: 'Frigates',
  description: 'Frigate',
  imageUrl: undefined,
  dataVersion: 'test',
  lastUpdated: new Date().toISOString(),
  attributes: [
    { label: 'Signature Radius', value: 35, unit: 'm' },
  ],
  marketLineage: [
    { id: 'ships', name: 'Ships' },
    { id: 'frigates', name: 'Frigates' },
  ],
  isPartial: true,
};

vi.mock('../../components/ItemDetail/MarketInsightsSection', () => ({
  MarketInsightsSection: () => <div data-testid="market-section">Market data</div>,
}));

vi.mock('../../hooks/api/useItemDetailQuery', () => ({
  useItemDetailQuery: vi.fn(() => ({
    data: baseDetail,
    isFetching: false,
  })),
}));

vi.mock('../../features/market-browser/parseShowInfo', () => ({
  useParsedShowInfo: vi.fn(() => null),
}));

expect.extend(toHaveNoViolations);

function renderPanel() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ItemDetailPanel />
    </QueryClientProvider>,
  );
}

describe('ItemDetailPanel accessibility', () => {
  beforeEach(() => {
    useMarketBrowserStore.getState().reset();
    useMarketBrowserStore.getState().setActiveType(baseDetail.typeId);
  });

  afterEach(() => {
    useMarketBrowserStore.getState().reset();
  });

  it('renders fallback silhouette with accessible label', () => {
    renderPanel();
    expect(screen.getByRole('img', { name: /Atron placeholder/i })).toBeInTheDocument();
  });

  it('passes axe audit for detail layout', async () => {
    const { container } = renderPanel();

    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });

    expect(results).toHaveNoViolations();
  });
});
