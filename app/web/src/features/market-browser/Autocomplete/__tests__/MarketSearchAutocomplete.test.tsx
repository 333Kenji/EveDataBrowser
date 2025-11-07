import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketSearchAutocomplete } from '../MarketSearchAutocomplete';
import * as taxonomy from '../../../../services/taxonomy-service';
import { useDropdownStore } from '../../../../state/dropdown-store';
import { useMarketBrowserStore } from '../../marketBrowserStore';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('MarketSearchAutocomplete', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useDropdownStore.getState().reset();
    useMarketBrowserStore.getState().reset();
  });

  it('fetches suggestions and selects a result via keyboard', async () => {
    const suggestions: taxonomy.TaxonomySuggestion[] = [
      {
        id: '587',
        typeId: '587',
        name: 'Rifter',
        categoryId: 'cat-ships',
        categoryName: 'Ships',
        groupId: 'group-frigate',
        groupName: 'Frigates',
      },
      {
        id: '2006',
        typeId: '2006',
        name: 'Caracal',
        categoryId: 'cat-ships',
        categoryName: 'Ships',
        groupId: 'group-cruiser',
        groupName: 'Cruisers',
      },
    ];

    const fetchSpy = vi
      .spyOn(taxonomy, 'fetchTaxonomySuggestions')
      .mockResolvedValue(suggestions);

    renderWithClient(<MarketSearchAutocomplete />);
    const input = screen.getByRole('combobox', { name: /market navigation search/i });

  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'rif' } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('rif', 12);
    });

    const firstOption = await screen.findByRole('option', { name: /rifter/i });
    expect(firstOption).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(useMarketBrowserStore.getState().activeTypeId).toBe('587');
    });
    expect(useDropdownStore.getState().query).toBe('Rifter');
  });
});
