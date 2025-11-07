import { useCallback } from 'react';
import type { TaxonomyType } from '../../services/taxonomy-service';
import { useDropdownStore } from '../../state/dropdown-store';
import { useMarketBrowserStore } from './marketBrowserStore';

/**
 * Shared helper that mirrors accordion selection behaviour so other UI surfaces
 * (search autocomplete, quick actions) can reuse the same store updates.
 */
export function useSelectTaxonomyType() {
  const setDropdownQuery = useMarketBrowserStore((state) => state.setDropdownQuery);
  const setActiveType = useMarketBrowserStore((state) => state.setActiveType);
  const dropdownStoreSetQuery = useDropdownStore((state) => state.setQuery);

  return useCallback(
    (type: TaxonomyType) => {
      dropdownStoreSetQuery(type.name);
      setDropdownQuery(type.name);
      setActiveType(type.id);
    },
    [dropdownStoreSetQuery, setDropdownQuery, setActiveType],
  );
}
