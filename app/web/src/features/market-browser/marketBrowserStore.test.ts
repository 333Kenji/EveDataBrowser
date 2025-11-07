import { beforeEach, describe, expect, it } from 'vitest';
import { useMarketBrowserStore } from './marketBrowserStore';

function resetStore() {
  useMarketBrowserStore.setState({
    activeView: 'ship',
    activeTypeId: null,
    dropdownQuery: '',
    pendingLineage: null,
    lineageToken: 0,
  });
}

describe('marketBrowserStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('captures lineage replay requests with incrementing token', () => {
    const lineage = ['6', '61', '603'];
    useMarketBrowserStore.getState().revealLineage(lineage);

    const snapshot = useMarketBrowserStore.getState();
    expect(snapshot.pendingLineage).toEqual(lineage);
    expect(snapshot.lineageToken).toBe(1);

    // Mutating the original array should not affect the store copy.
    lineage.push('extra');
    expect(useMarketBrowserStore.getState().pendingLineage).toEqual(['6', '61', '603']);
  });

  it('clears lineage requests when applied', () => {
    useMarketBrowserStore.getState().revealLineage(['6', '61', '603']);
    useMarketBrowserStore.getState().clearLineageRequest();

    const snapshot = useMarketBrowserStore.getState();
    expect(snapshot.pendingLineage).toBeNull();
    expect(snapshot.lineageToken).toBe(1);
  });

  it('resets pending lineage when active type changes', () => {
    useMarketBrowserStore.getState().revealLineage(['6', '61', '603']);
    useMarketBrowserStore.getState().setActiveType('603');

    const snapshot = useMarketBrowserStore.getState();
    expect(snapshot.pendingLineage).toBeNull();
    expect(snapshot.activeTypeId).toBe('603');
  });
});
