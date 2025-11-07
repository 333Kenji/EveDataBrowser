import { beforeEach, describe, expect, it } from 'vitest';
import { useMarketHistoryStore } from './marketHistoryStore';

const DEFAULT_TOGGLES = { ...useMarketHistoryStore.getState().toggles };

function resetStore() {
  useMarketHistoryStore.setState({
    toggles: { ...DEFAULT_TOGGLES },
    viewport: { start: null, end: null },
  });
}

describe('marketHistoryStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('updates individual toggles without affecting others', () => {
    const initial = useMarketHistoryStore.getState().toggles;
    expect(initial.showMedian).toBe(true);

    useMarketHistoryStore.getState().setToggle('showMedian', false);
    useMarketHistoryStore.getState().setToggle('showVolume', false);

    const toggles = useMarketHistoryStore.getState().toggles;
    expect(toggles.showMedian).toBe(false);
    expect(toggles.showVolume).toBe(false);
    expect(toggles.showDonchian).toBe(true);
  });

  it('tracks viewport updates and resets to defaults', () => {
    useMarketHistoryStore.getState().setViewport(10, 25);
    expect(useMarketHistoryStore.getState().viewport).toEqual({ start: 10, end: 25 });

    useMarketHistoryStore.getState().resetViewport();
    expect(useMarketHistoryStore.getState().viewport).toEqual({ start: null, end: null });
  });
});
