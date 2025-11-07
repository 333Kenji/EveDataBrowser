import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketAccordion } from '../MarketAccordion';
import * as taxonomy from '../../../../services/taxonomy-service';

describe('MarketAccordion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
    }
  });

  it('renders categories and allows expanding and selecting a type', async () => {
    const mockData = {
      categories: [
        {
          id: 'ships',
          name: 'Ships',
          groups: [
            {
              id: 'group-frigates',
              name: 'Frigates',
              categoryId: 'ships',
              types: [
                { id: '587', typeId: '587', name: 'Rifter', groupId: 'group-frigates', categoryId: 'ships' },
                { id: '111', typeId: '111', name: 'Federation Navy Comet', groupId: 'group-frigates', categoryId: 'ships' },
              ],
            },
            {
              id: 'group-cruisers',
              name: 'Cruisers',
              categoryId: 'ships',
              types: [
                { id: '2006', typeId: '2006', name: 'Caracal', groupId: 'group-cruisers', categoryId: 'ships' },
              ],
            },
          ],
          typeCount: 3,
        },
      ],
      dataVersion: 'test',
      latencyMs: 5,
    } as taxonomy.TaxonomySearchResponse;

    vi.spyOn(taxonomy, 'fetchTaxonomy').mockResolvedValueOnce(mockData);

    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
  <MarketAccordion />
      </QueryClientProvider>
    );

    // Wait for category button
    const categoryBtn = await screen.findByRole('button', { name: /ships/i });
    fireEvent.click(categoryBtn);
    const groupBtn = await screen.findByRole('button', { name: /^Frigates$/i });
    fireEvent.click(groupBtn);
    const rifterBtn = await screen.findByRole('button', { name: /rifter/i });
    fireEvent.click(rifterBtn);

    await waitFor(() => {
      expect(rifterBtn.getAttribute('data-active')).not.toBeNull();
    });

    const cometBtn = await screen.findByRole('button', { name: /federation navy comet/i });
    fireEvent.click(cometBtn);

    await waitFor(() => {
      expect(cometBtn.getAttribute('data-active')).not.toBeNull();
    });
  });

  it('omits uncategorized buckets from the rendered hierarchy', async () => {
    const mockData = {
      categories: [
        {
          id: 'market-category-uncategorized',
          name: 'Uncategorized',
          groups: [
            {
              id: 'market-group-uncategorized',
              name: 'Unassigned',
              categoryId: 'market-category-uncategorized',
              types: [
                { id: '1', typeId: '1', name: 'Should Not Render', groupId: 'market-group-uncategorized', categoryId: 'market-category-uncategorized' },
              ],
            },
          ],
          typeCount: 1,
        },
        {
          id: 'ships',
          name: 'Ships',
          groups: [
            {
              id: 'group-destroyers',
              name: 'Destroyers',
              categoryId: 'ships',
              types: [
                { id: '16242', typeId: '16242', name: 'Cormorant', groupId: 'group-destroyers', categoryId: 'ships' },
              ],
            },
            {
              id: 'market-group-uncategorized',
              name: 'Unassigned',
              categoryId: 'ships',
              types: [
                { id: '999', typeId: '999', name: 'Fallback Type', groupId: 'market-group-uncategorized', categoryId: 'ships' },
              ],
            },
          ],
          typeCount: 2,
        },
      ],
      dataVersion: 'test',
      latencyMs: 3,
    } as taxonomy.TaxonomySearchResponse;

    vi.spyOn(taxonomy, 'fetchTaxonomy').mockResolvedValueOnce(mockData);

    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MarketAccordion />
      </QueryClientProvider>
    );

    // Ensure only the legitimate category renders
    expect(await screen.findByRole('button', { name: /ships/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /uncategorized/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /ships/i }));

    // Only the destroyers group should render; uncategorized buckets are filtered out
    expect(await screen.findByRole('button', { name: /^Destroyers$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unassigned/i })).toBeNull();
  });
});
