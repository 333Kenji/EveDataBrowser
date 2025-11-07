import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useMarketBrowserStore } from './marketBrowserStore';
import { ItemDetailPanel } from './ItemDetailPanel';

const originalFetch = global.fetch;

const baseDetail = {
  typeId: 100,
  name: 'Test Item',
  description: 'Default description',
  published: true,
  group: {
    id: 200,
    name: 'Test Group',
  },
  category: {
    id: 300,
    name: 'Test Category',
  },
  meta: {
    groupId: null,
    groupName: null,
    metaLevel: 5,
  },
  marketGroup: null,
  faction: null,
  raceId: null,
  mass: 1,
  volume: 1,
  basePrice: 10,
  blueprint: null,
  materials: [
    {
      materialTypeId: 34,
      materialName: 'Tritanium',
      quantity: 1,
      groupId: 18,
      groupName: 'Mineral',
    },
  ],
};

function mockItemDetail(overrides: Partial<typeof baseDetail> = {}) {
  const payload = { ...baseDetail, ...overrides };
  if (!('materials' in overrides)) {
    payload.materials = baseDetail.materials;
  }

  (globalThis as any).fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
    headers: new Headers({ 'last-modified': 'Mon, 13 Oct 2025 12:00:00 GMT' }),
  }));
}

function mockMalformedDetail() {
  (globalThis as any).fetch = vi.fn(async () => ({
    ok: false,
    status: 500,
    json: async () => ({ message: 'unexpected error' }),
    headers: new Headers(),
  }));
}

function setType(typeId: string) {
  useMarketBrowserStore.setState({ activeTypeId: typeId });
}

function createTestClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('ItemDetailPanel regression', () => {
  beforeEach(() => {
    (global as any).fetch = originalFetch;
    useMarketBrowserStore.setState({ activeTypeId: null });
  });

  it('renders prompt when no active type', () => {
    const qc = createTestClient();
    render(<QueryClientProvider client={qc}><ItemDetailPanel /></QueryClientProvider>);
    expect(screen.getByText(/Select a type/i)).toBeTruthy();
  });

  it('renders description with showinfo link converted to button', async () => {
    mockItemDetail({
      description: 'Build using <a href="showinfo:200">Other Item</a> components.',
      name: 'Test Item',
      typeId: 100,
    });
    setType('100');
    const qc = createTestClient();
    render(<QueryClientProvider client={qc}><ItemDetailPanel /></QueryClientProvider>);
    const btn = await screen.findByRole('button', { name: 'Other Item' });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    // clicking should set activeTypeId to 200
    expect(useMarketBrowserStore.getState().activeTypeId).toBe('200');
  });

  it('shows partial message when API returns incomplete data', async () => {
    mockItemDetail({ description: null, materials: [] });
    setType('100');
    const qc = createTestClient();
    render(<QueryClientProvider client={qc}><ItemDetailPanel /></QueryClientProvider>);
    expect(await screen.findByText(/Partial data/i)).toBeTruthy();
  });

  it('shows error message when detail fetch fails validation', async () => {
    mockMalformedDetail();
    setType('999');
    const qc = createTestClient();
    render(<QueryClientProvider client={qc}><ItemDetailPanel /></QueryClientProvider>);
  await waitFor(() => expect(screen.queryByText(/Loading item detail…/)).not.toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/No detail available for type 999/i)).toBeTruthy();
  });
});
