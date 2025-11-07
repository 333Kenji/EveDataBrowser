import { useEffect, useMemo, useState } from 'react';
import type { TaxonomyCategory } from '../services/taxonomy-service';
import { useDropdownStore } from '../state/dropdown-store';
import {
  emitDropdownEvent,
  emitEmptyResults,
  emitLatencyMetrics,
  emitSearchError,
} from '../analytics/dropdown-events';
import { useTaxonomyBrowseQuery } from './api/useTaxonomyBrowseQuery';

const MAX_RESULTS_THRESHOLD = 8;

function flattenResults(categories: TaxonomyCategory[]): number {
  return categories.reduce((total, category) => total + category.typeCount, 0);
}

export function useDropdownSearch() {
  const store = useDropdownStore();
  const [debouncedQuery, setDebouncedQuery] = useState(store.query);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(store.query.trim()), 140);
    return () => clearTimeout(handle);
  }, [store.query]);

  const taxonomyQuery = useTaxonomyBrowseQuery(debouncedQuery, {
    onSuccess: (response) => {
      const totalTypes = flattenResults(response.categories);
      emitLatencyMetrics(response.latencyMs);

      console.log('[dropdown-debug] taxonomy response', {
        query: debouncedQuery,
        totalTypes,
        categories: response.categories.map((category) => ({
          name: category.name,
          groups: category.groups.map((group) => ({
            name: group.name,
            typeCount: group.types.length,
            childGroups: group.groups?.map((child) => ({ name: child.name, typeCount: child.types.length })) ?? [],
          })),
        })),
      });

      if (totalTypes === 0) {
        if (debouncedQuery) {
          emitEmptyResults(debouncedQuery);
        }
        store.setStatus('empty', {
          message: debouncedQuery ? 'No results. Adjust filters.' : 'Start typing to filter items.',
          latencyMs: response.latencyMs,
          dataVersion: response.dataVersion,
        });
      } else {
        store.setStatus('idle', {
          dataVersion: response.dataVersion,
          message: totalTypes > MAX_RESULTS_THRESHOLD ? 'Showing top matches.' : undefined,
        });
      }
      store.setResultsCount(totalTypes);
      setCategories(response.categories);
    },
    onError: () => {
      store.setStatus('error', { message: 'Unable to load taxonomy. Try again.' });
      emitSearchError('Unable to load taxonomy. Try again.');
      setCategories([]);
      store.setResultsCount(0);
    },
  });

  const { isOpen, status, meta, setStatus } = store;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (taxonomyQuery.fetchStatus === 'fetching' && status !== 'loading') {
      setStatus('loading', meta);
    }
  }, [taxonomyQuery.fetchStatus, isOpen, status, meta, setStatus]);

  const categories = taxonomyQuery.data?.categories ?? [];

  const isLoading = taxonomyQuery.fetchStatus === 'fetching' || taxonomyQuery.isPending;

  const select = (selection: { id: string; label: string; categoryId: string; groupId: string }) => {
    store.addSelection(selection);
    const nextCount = useDropdownStore.getState().selections.length;
    emitDropdownEvent('selection:add', {
      selectionId: selection.id,
      categoryId: selection.categoryId,
      groupId: selection.groupId,
      totalSelections: nextCount,
    });

    const pinnedId = useDropdownStore.getState().pinnedDetailId;
    if (!pinnedId) {
      useDropdownStore.getState().setActiveDetail(selection.id);
    }
  };

  const remove = (selectionId: string) => {
    const currentState = useDropdownStore.getState();
    const nextSelections = currentState.selections.filter((item) => item.id !== selectionId);
    store.removeSelection(selectionId);
    const nextCount = useDropdownStore.getState().selections.length;
    emitDropdownEvent('selection:remove', {
      selectionId,
      totalSelections: nextCount,
    });

    if (currentState.pinnedDetailId === selectionId) {
      currentState.togglePinnedDetail(selectionId);
    }

    if (currentState.activeDetailId === selectionId) {
      const fallbackSelection = nextSelections[0];
      currentState.setActiveDetail(fallbackSelection ? fallbackSelection.id : null);
    }
  };

  const clear = () => {
    store.clearSelections();
    useDropdownStore.getState().setActiveDetail(null);
    const pinned = useDropdownStore.getState().pinnedDetailId;
    if (pinned) {
      useDropdownStore.getState().togglePinnedDetail(pinned);
    }
    emitDropdownEvent('selection:clear', {});
  };

  const reorder = (fromIndex: number, toIndex: number) => {
    store.reorderSelections(fromIndex, toIndex);
    emitDropdownEvent('selection:reorder', {
      fromIndex,
      toIndex,
    });
  };

  const open = () => store.setOpen(true);
  const close = () => store.setOpen(false);

  const resultSummary = useMemo(() => ({
    isLoading,
    categories,
    totalResults: store.resultsCount,
    status: store.status,
    meta: store.meta,
  }), [categories, isLoading, store.resultsCount, store.status, store.meta]);

  return {
    ...store,
  taxonomyQuery,
    categories,
    resultSummary,
    select,
    remove,
    clear,
    reorder,
    open,
    close,
    setQuery: store.setQuery,
  };
}
