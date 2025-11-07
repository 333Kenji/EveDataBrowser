import { create } from 'zustand';

export interface MarketHistoryToggles {
  showMedian: boolean;
  showMinMax: boolean;
  showDonchian: boolean;
  showSMA5: boolean;
  showSMA20: boolean;
  showVolume: boolean;
}

export interface MarketHistoryViewport {
  start: number | null; // index
  end: number | null;   // index
}

interface MarketHistoryState {
  toggles: MarketHistoryToggles;
  viewport: MarketHistoryViewport;
  setToggle: (k: keyof MarketHistoryToggles, v: boolean) => void;
  setViewport: (start: number | null, end: number | null) => void;
  resetViewport: () => void;
}

export const useMarketHistoryStore = create<MarketHistoryState>((set) => ({
  toggles: {
    showMedian: true,
    showMinMax: true,
    showDonchian: true,
    showSMA5: true,
    showSMA20: true,
    showVolume: true,
  },
  viewport: { start: null, end: null },
  setToggle: (k, v) => set((s) => ({ toggles: { ...s.toggles, [k]: v } })),
  setViewport: (start, end) => set(() => ({ viewport: { start, end } })),
  resetViewport: () => set(() => ({ viewport: { start: null, end: null } })),
}));
