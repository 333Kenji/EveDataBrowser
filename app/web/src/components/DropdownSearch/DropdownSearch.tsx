import { useEffect, useMemo, useRef, useState } from 'react';
import { Combobox } from '@headlessui/react';
import { Controller, useForm } from 'react-hook-form';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DropdownSearchProps } from './types';
import { useDropdownSearch } from '../../hooks/useDropdownSearch';
import type { TaxonomyGroup, TaxonomyType } from '../../services/taxonomy-service';
import {
  dropdownShellClass,
  dropdownPanelClass,
  dropdownColumnClass,
  dropdownBannerClass,
} from './motif.css.ts';
import { SelectionList } from './SelectionList';
import { ItemDetailPanel } from '../../features/market-browser/ItemDetailPanel';
import { useMarketBrowserStore } from '../../features/market-browser/marketBrowserStore';

function findGroupById(groups: TaxonomyGroup[], id: string): TaxonomyGroup | undefined {
  for (const group of groups) {
    if (group.id === id) {
      return group;
    }

    if (group.groups) {
      const nested = findGroupById(group.groups, id);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

function groupHasTypes(group: TaxonomyGroup): boolean {
  if (group.types.length > 0) {
    return true;
  }

  return (group.groups ?? []).some((child) => groupHasTypes(child));
}

function findFirstGroupWithTypes(groups: TaxonomyGroup[]): TaxonomyGroup | undefined {
  for (const group of groups) {
    if (groupHasTypes(group)) {
      return group;
    }
  }

  return undefined;
}

function collectGroupTypes(group: TaxonomyGroup | null): TaxonomyType[] {
  if (!group) {
    return [];
  }

  const nestedTypes = (group.groups ?? []).flatMap((child) => collectGroupTypes(child));
  return [...group.types, ...nestedTypes];
}

interface SearchForm {
  filter: string;
}

export function DropdownSearch({ onSelectionsChange }: DropdownSearchProps) {
  const dropdown = useDropdownSearch();
  const setActiveType = useMarketBrowserStore((state) => state.setActiveType);
  const form = useForm<SearchForm>({
    defaultValues: { filter: dropdown.query },
  });

  const filterValue = form.watch('filter');

  const { setQuery, query } = dropdown;

  useEffect(() => {
    const nextValue = filterValue ?? '';
    if (query !== nextValue) {
      setQuery(nextValue);
    }
  }, [filterValue, query, setQuery]);

  useEffect(() => {
    setActiveType(dropdown.activeDetailId ?? null);
  }, [dropdown.activeDetailId, setActiveType]);

  useEffect(() => () => {
    setActiveType(null);
  }, [setActiveType]);

  useEffect(() => {
    onSelectionsChange?.(dropdown.selections);
  }, [dropdown.selections, onSelectionsChange]);

  useEffect(() => {
    dropdown.open();
    return () => dropdown.close();
  }, []);

  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [activeGroupId, setActiveGroupId] = useState<string>('');

  useEffect(() => {
    if (dropdown.categories.length === 0) {
      if (activeCategoryId !== '') {
        setActiveCategoryId('');
      }
      if (activeGroupId !== '') {
        setActiveGroupId('');
      }
      return;
    }

    const nextCategory =
      dropdown.categories.find((category) => category.id === activeCategoryId) ?? dropdown.categories[0];

    if (nextCategory.id !== activeCategoryId) {
      setActiveCategoryId(nextCategory.id);
    }

    const resolvedGroup = activeGroupId ? findGroupById(nextCategory.groups, activeGroupId) : undefined;
    if (resolvedGroup) {
      return;
    }

    const fallbackGroup = findFirstGroupWithTypes(nextCategory.groups) ?? nextCategory.groups[0];
    const nextGroupId = fallbackGroup?.id ?? '';
    if (nextGroupId !== activeGroupId) {
      setActiveGroupId(nextGroupId);
    }
  }, [dropdown.categories, activeCategoryId, activeGroupId]);

  const activeGroups = useMemo(() => {
    return dropdown.categories.find((category) => category.id === activeCategoryId)?.groups ?? [];
  }, [dropdown.categories, activeCategoryId]);

  const activeTypes = useMemo(() => {
    const activeGroup = findGroupById(activeGroups, activeGroupId) ?? null;
    return collectGroupTypes(activeGroup);
  }, [activeGroups, activeGroupId]);

  useEffect(() => {
    console.log('[dropdown-debug] active types', {
      category: activeCategoryId,
      group: activeGroupId,
      names: activeTypes.map((type) => type.name),
    });
    if (typeof window !== 'undefined') {
      // @ts-expect-error Debug field only used during investigation.
      window.__dropdownTypes = activeTypes.map((type) => type.name);
    }
  }, [activeTypes, activeCategoryId, activeGroupId]);

  const typesParentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: activeTypes.length,
    getScrollElement: () => typesParentRef.current,
    estimateSize: () => 48,
    overscan: 6,
  });

  useEffect(() => {
    typesParentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeGroupId]);

  const showLatencyWarning = dropdown.meta.latencyMs && dropdown.meta.latencyMs > 600;
  const isFetching = dropdown.taxonomyQuery.fetchStatus === 'fetching';
  const hasNoResults = !isFetching && dropdown.resultSummary.totalResults === 0 && dropdown.status !== 'error';

  return (
    <div className={`dropdown-search ${dropdownShellClass}`} data-status={dropdown.status}>
      <form className="dropdown-search__form" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="dropdown-search-input" className="dropdown-search__label">
          Find ships, modules, and more
        </label>
        <Controller
          control={form.control}
          name="filter"
          render={({ field }) => (
            <Combobox value={field.value ?? ''} onChange={(value: string | null) => field.onChange(value ?? '')}>
              <div className="dropdown-search__input-wrapper">
                <Combobox.Input
                  {...field}
                  id="dropdown-search-input"
                  data-testid="dropdown-search-input"
                  className="dropdown-search__input"
                  placeholder="Type to filter"
                  aria-label="Filter database results"
                  autoComplete="off"
                  onFocus={() => dropdown.open()}
                />
              </div>
            </Combobox>
          )}
        />
      </form>

      <div className={`${dropdownPanelClass} dropdown-search__panel`} role="region" aria-live="polite">
        <header className={`${dropdownBannerClass} dropdown-search__banner`}>
          <span>
            Dataset version: <strong>{dropdown.meta.dataVersion ?? 'loading…'}</strong>
          </span>
          {dropdown.resultSummary.totalResults > 0 && (
            <span>{dropdown.resultSummary.totalResults} matching types</span>
          )}
          {showLatencyWarning && <span className="dropdown-search__latency">High latency detected</span>}
        </header>

        <div className="dropdown-search__columns">
          <section className={`${dropdownColumnClass} dropdown-search__column`} aria-label="Categories">
            <h3>Categories</h3>
            <ul role="list">
              {dropdown.categories.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    className={category.id === activeCategoryId ? 'is-active' : ''}
                    onClick={() => {
                      setActiveCategoryId(category.id);
                      const nextGroup = findFirstGroupWithTypes(category.groups) ?? category.groups[0];
                      setActiveGroupId(nextGroup?.id ?? '');
                    }}
                  >
                    {category.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${dropdownColumnClass} dropdown-search__column`} aria-label="Groups">
            <h3>Groups</h3>
            <ul role="list">
              {activeGroups.map((group) => (
                <li key={group.id}>
                  <button
                    type="button"
                    className={group.id === activeGroupId ? 'is-active' : ''}
                    onClick={() => setActiveGroupId(group.id)}
                  >
                    {group.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`${dropdownColumnClass} dropdown-search__column dropdown-search__column--types`}
            aria-label="Types"
          >
            <h3>Types</h3>
            <div
              ref={typesParentRef}
              className="dropdown-search__types-viewport"
              role="listbox"
              aria-label="Available types"
              aria-multiselectable="true"
            >
              <div
                style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
                data-testid="dropdown-search-types"
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = activeTypes[virtualRow.index];
                  const isSelected = dropdown.selections.some((selection) => selection.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="dropdown-search__type"
                      aria-selected={isSelected}
                      data-selected={isSelected}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() =>
                        dropdown.select({
                          id: item.id,
                          label: item.name,
                          categoryId: item.categoryId,
                          categoryName: item.categoryName,
                          groupId: item.groupId,
                          groupName: item.groupName,
                          groupSummaryName:
                            item.lineage.find((node) => {
                              const nodeName = node.name?.toLowerCase() ?? '';
                              const categoryName = item.categoryName?.toLowerCase() ?? '';
                              return node.id !== item.categoryId && nodeName.length > 0 && nodeName !== categoryName;
                            })?.name ?? item.groupName,
                        })
                      }
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {dropdown.status === 'empty' && !hasNoResults && (
          <p className="dropdown-search__status" role="status">
            {dropdown.meta.message}
          </p>
        )}

        {dropdown.status === 'loading' && !hasNoResults && (
          <p className="dropdown-search__status" role="status">
            Loading results…
          </p>
        )}

        {hasNoResults && (
          <p className="dropdown-search__status" role="status">
            {dropdown.meta.message ?? 'No results. Adjust filters.'}
          </p>
        )}

        {dropdown.status === 'error' && (
          <p className="dropdown-search__status" role="alert">
            {dropdown.meta.message}
          </p>
        )}
      </div>

      <SelectionList
        selections={dropdown.selections}
        onRemove={dropdown.remove}
        onReorder={dropdown.reorder}
        onClear={dropdown.clear}
        onFocus={(selectionId) => dropdown.setActiveDetail(selectionId)}
        activeSelectionId={dropdown.activeDetailId}
        pinnedSelectionId={dropdown.pinnedDetailId}
      />

      <ItemDetailPanel />
    </div>
  );
}
