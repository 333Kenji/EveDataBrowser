import { createWithEqualityFn } from 'zustand/traditional';

export type DropdownSelection = {
  id: string;
  label: string;
  categoryId: string;
  groupId: string;
  categoryName?: string;
  groupName?: string;
  groupSummaryName?: string;
};

type DropdownStatus = 'idle' | 'loading' | 'error' | 'empty';

type DropdownSessionMeta = {
  message?: string;
  latencyMs?: number;
  dataVersion?: string;
};

export type DetailStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'error';

export type ItemDetailAttribute = {
  label: string;
  value: string | number;
  unit?: string;
  importance: 'core' | 'secondary';
};

export type ItemDetailRecord = {
  typeId: string;
  name: string;
  category: string;
  group: string;
  description?: string;
  imageUrl?: string;
  dataVersion: string;
  lastUpdated: string;
  attributes: ItemDetailAttribute[];
  isPartial?: boolean;
  marketLineage: Array<{ id: string; name: string }>;
};

export interface DropdownState {
  selections: DropdownSelection[];
  status: DropdownStatus;
  query: string;
  meta: DropdownSessionMeta;
  isOpen: boolean;
  resultsCount: number;
  activeDetailId: string | null;
  pinnedDetailId: string | null;
  detailHistory: string[];
}

interface DropdownActions {
  setSelections: (selections: DropdownSelection[]) => void;
  addSelection: (selection: DropdownSelection) => void;
  removeSelection: (selectionId: string) => void;
  clearSelections: () => void;
  reorderSelections: (fromIndex: number, toIndex: number) => void;
  setStatus: (status: DropdownStatus, meta?: DropdownSessionMeta) => void;
  setQuery: (query: string) => void;
  setOpen: (isOpen: boolean) => void;
  setResultsCount: (count: number) => void;
  reset: () => void;
  setActiveDetail: (typeId: string | null) => void;
  togglePinnedDetail: (typeId: string | null) => void;
  recordDetailView: (detail: ItemDetailRecord) => void;
  clearDetailState: () => void;
}

const initialState: DropdownState = {
  selections: [],
  status: 'idle',
  query: '',
  meta: {},
  isOpen: false,
  resultsCount: 0,
  activeDetailId: null,
  pinnedDetailId: null,
  detailHistory: [],
};

export type DropdownStore = DropdownState & DropdownActions;

export const useDropdownStore = createWithEqualityFn<DropdownStore>((set) => ({
  ...initialState,
  setSelections: (selections) => set({ selections }),
  addSelection: (selection) =>
    set((current) => ({
      selections: [...current.selections.filter((item) => item.id !== selection.id), selection],
    })),
  removeSelection: (selectionId) =>
    set((current) => ({
      selections: current.selections.filter((item) => item.id !== selectionId),
    })),
  clearSelections: () =>
    set({
      selections: [],
      pinnedDetailId: null,
      activeDetailId: null,
      detailHistory: [],
    }),
  reorderSelections: (fromIndex, toIndex) =>
    set((current) => {
      const next = [...current.selections];
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= next.length || toIndex >= next.length) {
        return {};
      }
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { selections: next };
    }),
  setStatus: (status, meta = {}) => set({ status, meta }),
  setQuery: (query) => set({ query }),
  setOpen: (isOpen) => set({ isOpen }),
  setResultsCount: (count) => set({ resultsCount: count }),
  setActiveDetail: (typeId) =>
    set((current) => {
      if (!typeId) {
        return { activeDetailId: null };
      }

      const history = typeId
        ? [typeId, ...current.detailHistory.filter((id) => id !== typeId)].slice(0, 4)
        : current.detailHistory;

      return {
        activeDetailId: typeId,
        detailHistory: history,
      };
    }),
  togglePinnedDetail: (typeId) =>
    set((current) => ({
      pinnedDetailId: current.pinnedDetailId === typeId ? null : typeId,
    })),
  recordDetailView: (detail) =>
    set((current) => ({
      activeDetailId: detail.typeId,
      detailHistory: [detail.typeId, ...current.detailHistory.filter((id) => id !== detail.typeId)].slice(0, 4),
    })),
  clearDetailState: () =>
    set({
      detailHistory: [],
      activeDetailId: null,
      pinnedDetailId: null,
    }),
  reset: () => set(initialState),
}));

export const getDropdownStateSnapshot = (): DropdownState => ({
  selections: useDropdownStore.getState().selections,
  status: useDropdownStore.getState().status,
  query: useDropdownStore.getState().query,
  meta: useDropdownStore.getState().meta,
  isOpen: useDropdownStore.getState().isOpen,
  resultsCount: useDropdownStore.getState().resultsCount,
  activeDetailId: useDropdownStore.getState().activeDetailId,
  pinnedDetailId: useDropdownStore.getState().pinnedDetailId,
  detailHistory: useDropdownStore.getState().detailHistory,
});
