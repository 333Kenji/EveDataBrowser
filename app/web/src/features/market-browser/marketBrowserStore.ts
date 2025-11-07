import { createWithEqualityFn } from 'zustand/traditional';
export type MarketBrowserView = 'ship'; // simplified

interface MarketBrowserState {
  activeView: MarketBrowserView;
  activeTypeId: string | null;
  dropdownQuery: string;
  pendingLineage: string[] | null;
  lineageToken: number;
}

interface MarketBrowserActions {
  setActiveView: (view: MarketBrowserView) => void;
  setActiveType: (typeId: string | null) => void;
  setDropdownQuery: (query: string) => void;
  revealLineage: (lineageIds: string[]) => void;
  clearLineageRequest: () => void;
  reset: () => void;
}

export type MarketBrowserStore = MarketBrowserState & MarketBrowserActions;

const initialState: MarketBrowserState = {
  activeView: 'ship',
  activeTypeId: null,
  dropdownQuery: '',
  pendingLineage: null,
  lineageToken: 0,
};

export const useMarketBrowserStore = createWithEqualityFn<MarketBrowserStore>((set) => ({
  ...initialState,
  setActiveView: (view) => set({ activeView: view }),
  setActiveType: (typeId) => set({ activeTypeId: typeId, pendingLineage: null }),
  setDropdownQuery: (query) => set({ dropdownQuery: query }),
  revealLineage: (lineageIds) =>
    set((state) => ({
      pendingLineage: Array.isArray(lineageIds) ? [...lineageIds] : null,
      lineageToken: state.lineageToken + 1,
    })),
  clearLineageRequest: () => set({ pendingLineage: null }),
  reset: () => set(initialState),
}));

export const marketBrowserSelectors = {
  activeView: (state: MarketBrowserStore) => state.activeView,
  activeTypeId: (state: MarketBrowserStore) => state.activeTypeId,
  dropdownQuery: (state: MarketBrowserStore) => state.dropdownQuery,
  pendingLineage: (state: MarketBrowserStore) => state.pendingLineage,
  lineageToken: (state: MarketBrowserStore) => state.lineageToken,
};
