import { beforeEach, describe, expect, it } from 'vitest';

import { useDropdownStore } from './dropdown-store';

function resetStore() {
  useDropdownStore.getState().reset();
}

describe('dropdown-store detail state', () => {
  beforeEach(() => {
    resetStore();
  });

  it('adds selections and tracks active detail with history', () => {
    const { addSelection, recordDetailView } = useDropdownStore.getState();

    addSelection({ id: 'atr', label: 'Atron', categoryId: 'ships', groupId: 'frigates' });
    recordDetailView({
      typeId: 'atr',
      name: 'Atron',
      category: 'Ships',
      group: 'Frigates',
      description: 'Frigate',
      dataVersion: 'test',
      lastUpdated: new Date().toISOString(),
      attributes: [],
      marketLineage: [],
    });

    expect(useDropdownStore.getState().activeDetailId).toBe('atr');
    expect(useDropdownStore.getState().detailHistory).toContain('atr');
  });

  it('supports pinning and clearing selections', () => {
    const store = useDropdownStore.getState();
    store.addSelection({ id: 'atr', label: 'Atron', categoryId: 'ships', groupId: 'frigates' });
    store.addSelection({ id: 'cor', label: 'Cormorant', categoryId: 'ships', groupId: 'destroyers' });

    store.setActiveDetail('atr');
    store.togglePinnedDetail('atr');
    expect(useDropdownStore.getState().pinnedDetailId).toBe('atr');

    store.clearSelections();
    expect(useDropdownStore.getState().selections).toHaveLength(0);
    expect(useDropdownStore.getState().pinnedDetailId).toBeNull();
    expect(useDropdownStore.getState().detailHistory).toHaveLength(0);
  });

  it('maintains a capped, deduplicated detail history to support session replay', () => {
    const store = useDropdownStore.getState();
    const now = new Date().toISOString();

    ['a', 'b', 'c', 'd', 'e'].forEach((id) => {
      store.recordDetailView({
        typeId: id,
        name: `Item-${id}`,
        category: 'Ships',
        group: 'Cruisers',
        dataVersion: 'test',
        lastUpdated: now,
        attributes: [],
        marketLineage: [],
      });
    });

    expect(useDropdownStore.getState().detailHistory).toEqual(['e', 'd', 'c', 'b']);

    // Re-playing a prior id should promote it to the front without duplicates.
    store.recordDetailView({
      typeId: 'c',
      name: 'Item-c',
      category: 'Ships',
      group: 'Cruisers',
      dataVersion: 'test',
      lastUpdated: now,
      attributes: [],
      marketLineage: [],
    });

    expect(useDropdownStore.getState().detailHistory).toEqual(['c', 'e', 'd', 'b']);
  });
});
