import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { TaxonomyCategory, TaxonomyGroup, TaxonomyType } from '../../../services/taxonomy-service';
import styles from './MarketAccordion.module.css';
import { useQuery } from '@tanstack/react-query';
import { fetchTaxonomy } from '../../../services/taxonomy-service';
import { useMarketBrowserStore } from '../marketBrowserStore';
import { useSelectTaxonomyType } from '../useSelectTaxonomyType';
import { getCategoryIcon } from './icon-map';

const UNCATEGORIZED_CATEGORY_ID = 'market-category-uncategorized';
const UNCATEGORIZED_GROUP_ID = 'market-group-uncategorized';
const UNCATEGORIZED_LABELS = new Set(['uncategorized', 'unassigned']);

function normalizeTypes(types: TaxonomyType[] | undefined): TaxonomyType[] {
  if (!Array.isArray(types)) {
    return [];
  }

  const seen = new Set<string>();
  const result: TaxonomyType[] = [];

  for (const type of types) {
    if (!type || typeof type.id !== 'string' || type.id.trim().length === 0) {
      continue;
    }
    if (typeof type.name !== 'string' || type.name.trim().length === 0) {
      continue;
    }
    if (seen.has(type.id)) {
      continue;
    }
    seen.add(type.id);
    result.push(type);
  }

  return result;
}

function countTypes(group: TaxonomyGroup): number {
  const direct = (group.types ?? []).length;
  const nested = (group.groups ?? []).reduce<number>((total, child) => total + countTypes(child), 0);
  return direct + nested;
}

function pruneGroup(group: TaxonomyGroup | null | undefined): TaxonomyGroup | null {
  if (!group) {
    return null;
  }

  const normalizedName = group.name?.trim().toLowerCase() ?? '';
  if (group.id === UNCATEGORIZED_GROUP_ID || UNCATEGORIZED_LABELS.has(normalizedName)) {
    return null;
  }

  const childGroups = (group.groups ?? [])
    .map(pruneGroup)
    .filter((child): child is TaxonomyGroup => child !== null);

  const visibleTypes = normalizeTypes(group.types);

  if (visibleTypes.length === 0 && childGroups.length === 0) {
    return null;
  }

  return {
    ...group,
    types: visibleTypes,
    groups: childGroups.length > 0 ? childGroups : undefined,
  } satisfies TaxonomyGroup;
}

function flattenRedundantGroupLayers(groups: TaxonomyGroup[] | undefined, parentName: string | undefined): TaxonomyGroup[] {
  if (!Array.isArray(groups) || groups.length === 0) {
    return [];
  }

  const normalizedParent = typeof parentName === 'string' ? parentName.trim().toLowerCase() : '';
  const flattened: TaxonomyGroup[] = [];

  for (const group of groups) {
    if (!group) {
      continue;
    }

    const childGroups = flattenRedundantGroupLayers(group.groups, group.name);
    const normalizedGroupName = typeof group.name === 'string' ? group.name.trim().toLowerCase() : '';

    const nextGroup: TaxonomyGroup = {
      ...group,
      groups: childGroups.length > 0 ? childGroups : undefined,
    } satisfies TaxonomyGroup;

    if (
      normalizedParent &&
      normalizedGroupName === normalizedParent &&
      (!Array.isArray(nextGroup.types) || nextGroup.types.length === 0) &&
      childGroups.length > 0
    ) {
      flattened.push(...childGroups);
      continue;
    }

    flattened.push(nextGroup);
  }

  return flattened;
}

function sanitizeCategories(categories: TaxonomyCategory[] | undefined | null): TaxonomyCategory[] {
  if (!Array.isArray(categories)) {
    return [];
  }

  const seenKeys = new Set<string>();
  const sanitized: TaxonomyCategory[] = [];

  for (const rawCategory of categories) {
    if (!rawCategory) {
      continue;
    }

    const normalizedId = typeof rawCategory.id === 'string' ? rawCategory.id.trim() : '';
    const normalizedName = typeof rawCategory.name === 'string' ? rawCategory.name.trim().toLowerCase() : '';
    if (normalizedId === UNCATEGORIZED_CATEGORY_ID || UNCATEGORIZED_LABELS.has(normalizedName)) {
      continue;
    }

    const dedupeKey = normalizedId.length > 0 ? normalizedId : normalizedName;
    if (!dedupeKey || seenKeys.has(dedupeKey)) {
      continue;
    }

    const prunedGroups = (rawCategory.groups ?? [])
      .map(pruneGroup)
      .filter((group): group is TaxonomyGroup => group !== null);

    const groups = flattenRedundantGroupLayers(prunedGroups, rawCategory.name);

    const typeCount = groups.reduce((total, group) => total + countTypes(group), 0);
    if (groups.length === 0 || typeCount === 0) {
      continue;
    }

    sanitized.push({
      ...rawCategory,
      id: normalizedId.length > 0 ? normalizedId : rawCategory.id,
      groups,
      typeCount,
    } satisfies TaxonomyCategory);

    seenKeys.add(dedupeKey);
  }

  return sanitized;
}

function collectGroupIds(group: TaxonomyGroup | null | undefined, set: Set<string>): void {
  if (!group || typeof group.id !== 'string' || group.id.trim().length === 0) {
    return;
  }

  const id = group.id.trim();
  if (set.has(id)) {
    return;
  }
  set.add(id);

  for (const child of group.groups ?? []) {
    collectGroupIds(child, set);
  }
}

function collectKnownLineageIds(categories: TaxonomyCategory[]): Set<string> {
  const ids = new Set<string>();

  for (const category of categories) {
    if (!category || typeof category.id !== 'string') {
      continue;
    }

    const categoryId = category.id.trim();
    if (categoryId.length > 0) {
      ids.add(categoryId);
    }

    for (const group of category.groups ?? []) {
      collectGroupIds(group, ids);
    }
  }

  return ids;
}

function groupContainsId(group: TaxonomyGroup | null | undefined, targetId: string): boolean {
  if (!group || typeof group.id !== 'string') {
    return false;
  }

  if (group.id === targetId) {
    return true;
  }

  return (group.groups ?? []).some((child) => groupContainsId(child, targetId));
}

function findCategoryIdForNode(categories: TaxonomyCategory[], nodeId: string): string | null {
  for (const category of categories) {
    if (!category || typeof category.id !== 'string') {
      continue;
    }

    if (category.id === nodeId) {
      return category.id;
    }

    if ((category.groups ?? []).some((group) => groupContainsId(group, nodeId))) {
      return category.id;
    }
  }

  return null;
}

function buildAccordionLineage(lineage: string[], categories: TaxonomyCategory[]): string[] {
  if (lineage.length === 0 || categories.length === 0) {
    return [];
  }

  const knownIds = collectKnownLineageIds(categories);
  const filtered: string[] = [];

  for (const id of lineage) {
    if (typeof id === 'string' && knownIds.has(id)) {
      filtered.push(id);
    }
  }

  if (filtered.length === 0) {
    return [];
  }

  const categoryId = filtered.reduce<string | null>((acc, current) => acc ?? findCategoryIdForNode(categories, current), null);

  if (!categoryId) {
    return filtered;
  }

  const ordered: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | null | undefined) => {
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    ordered.push(value);
  };

  add(categoryId);
  for (const id of filtered) {
    add(id);
  }

  return ordered;
}

const SESSION_STORAGE_KEY = 'market-taxonomy-categories-v2';

function readCachedCategories(): TaxonomyCategory[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as TaxonomyCategory[];
    return sanitizeCategories(parsed);
  } catch {
    return [];
  }
}

function writeCachedCategories(categories: TaxonomyCategory[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload = sanitizeCategories(categories);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Persist cache best-effort only.
  }
}

interface NodeCategoryProps {
  category: TaxonomyCategory;
  onSelectType: (type: TaxonomyType) => void;
  activeTypeId: string | null;
}

interface ActiveTypeLookup {
  type: TaxonomyType;
  lineageIds: string[];
}

function findTypeInGroup(group: TaxonomyGroup, targetTypeId: string, lineage: string[]): ActiveTypeLookup | null {
  const nextLineage = [...lineage, group.id];
  const match = (group.types ?? []).find((type) => type.id === targetTypeId);
  if (match) {
    return { type: match, lineageIds: nextLineage };
  }

  for (const child of group.groups ?? []) {
    const result = findTypeInGroup(child, targetTypeId, nextLineage);
    if (result) {
      return result;
    }
  }

  return null;
}

function findActiveType(categories: TaxonomyCategory[], targetTypeId: string | null): ActiveTypeLookup | null {
  if (!targetTypeId) {
    return null;
  }

  for (const category of categories) {
    const lineageStart = [category.id];

    for (const group of category.groups ?? []) {
      const result = findTypeInGroup(group, targetTypeId, lineageStart);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

interface GroupNodeProps {
  group: TaxonomyGroup;
  parentLabel?: string | null;
  onSelectType: (t: TaxonomyType) => void;
  activeTypeId: string | null;
  openGroupId: string | null;
  setOpenGroupId: (id: string | null) => void;
  activeLineageIds: string[];
  activeLineageSet: Set<string>;
  targetLineage: string[] | null;
  onTargetConsumed: () => void;
  onUserInteraction: () => void;
}

function GroupNode({
  group,
  parentLabel,
  onSelectType,
  activeTypeId,
  openGroupId,
  setOpenGroupId,
  activeLineageIds,
  activeLineageSet,
  targetLineage,
  onTargetConsumed,
  onUserInteraction,
}: GroupNodeProps) {
  const [openChildGroupId, setOpenChildGroupId] = useState<string | null>(null);
  const open = openGroupId === group.id;
  const hasNestedGroups = Boolean(group.groups && group.groups.length > 0);
  const lastAutoTypeRef = useRef<string | null>(null);
  const displayLabel = useMemo(() => {
    const rawGroupLabel = typeof group.name === 'string' && group.name.trim().length > 0 ? group.name.trim() : 'Group';
    const normalizedParent = typeof parentLabel === 'string' ? parentLabel.trim().toLowerCase() : '';
    const normalizedGroup = rawGroupLabel.toLowerCase();
    if (normalizedParent && normalizedParent === normalizedGroup) {
      const base = parentLabel?.trim() ?? rawGroupLabel;
      return `All ${base}`.trim();
    }
    return rawGroupLabel;
  }, [group.name, parentLabel]);

  const toggle = () => {
    onUserInteraction();
    setOpenGroupId(open ? null : group.id);
  };

  const shouldBeOpen = activeLineageSet.has(group.id);

  useEffect(() => {
    if (!shouldBeOpen) {
      return;
    }

    if (activeTypeId && lastAutoTypeRef.current === activeTypeId) {
      return;
    }

    if (openGroupId !== group.id) {
      setOpenGroupId(group.id);
    }

    const groupIndex = activeLineageIds.indexOf(group.id);
    const nextChildId = groupIndex >= 0 ? activeLineageIds[groupIndex + 1] ?? null : null;

    if (nextChildId) {
      if (openChildGroupId !== nextChildId) {
        setOpenChildGroupId(nextChildId);
      }
    } else if (openChildGroupId !== null) {
      setOpenChildGroupId(null);
    }

    lastAutoTypeRef.current = activeTypeId ?? null;
  }, [activeLineageIds, activeLineageSet, activeTypeId, group.id, openChildGroupId, openGroupId, setOpenChildGroupId, setOpenGroupId, shouldBeOpen]);

  useEffect(() => {
    if (!open) {
      setOpenChildGroupId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!targetLineage || targetLineage[0] !== group.id) {
      return;
    }

    if (!open) {
      setOpenGroupId(group.id);
    }

    const [, ...rest] = targetLineage;
    if (rest.length === 0) {
      onTargetConsumed();
      return;
    }

    const nextChildId = rest[0] ?? null;
    if (nextChildId) {
      setOpenChildGroupId(nextChildId);
    }
  }, [group.id, onTargetConsumed, open, setOpenGroupId, targetLineage]);

  return (
    <li className={styles.group} data-open={open || undefined}>
      <button className={styles.groupButton} type="button" onClick={toggle} aria-expanded={open}>
        <span className={styles.caret} aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className={styles.icon} aria-hidden="true">
          {getCategoryIcon(group.name)}
        </span>
        <span className={styles.label}>{displayLabel}</span>
      </button>
      {open && hasNestedGroups && (
        <ul className={styles.groupList} role="list">
          {(group.groups ?? []).map((childGroup) => (
            <GroupNode
              key={childGroup.id}
              group={childGroup}
              parentLabel={group.name}
              onSelectType={onSelectType}
              activeTypeId={activeTypeId}
              openGroupId={openChildGroupId}
              setOpenGroupId={setOpenChildGroupId}
              activeLineageIds={activeLineageIds}
              activeLineageSet={activeLineageSet}
              targetLineage={targetLineage && targetLineage[0] === childGroup.id ? targetLineage.slice(1) : null}
              onTargetConsumed={onTargetConsumed}
              onUserInteraction={onUserInteraction}
            />
          ))}
        </ul>
      )}
      {open && !hasNestedGroups && (
        <ul className={styles.typeList} role="list">
          {(group.types ?? []).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={styles.typeButton}
                data-active={activeTypeId === t.id || undefined}
                onClick={() => {
                  onSelectType(t);
                }}
              >
                <span className={styles.typeAffordance} aria-hidden="true">
                  <span className={styles.typeBullet} />
                </span>
                <span className={styles.typeLabel}>{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface CategoryNodeProps extends NodeCategoryProps {
  openCategoryId: string | null;
  setOpenCategoryId: (id: string | null) => void;
  activeLineageIds: string[];
  activeLineageSet: Set<string>;
  targetLineage: string[] | null;
  onTargetConsumed: () => void;
  onUserInteraction: () => void;
}

function CategoryNode({
  category,
  onSelectType,
  activeTypeId,
  activeLineageIds,
  activeLineageSet,
  openCategoryId,
  setOpenCategoryId,
  targetLineage,
  onTargetConsumed,
  onUserInteraction,
}: CategoryNodeProps) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const open = openCategoryId === category.id;
  const lastAutoTypeRef = useRef<string | null>(null);

  const toggle = () => {
    onUserInteraction();
    setOpenCategoryId(open ? null : category.id);
    setOpenGroupId(null);
  };

  useEffect(() => {
    if (!open || !activeLineageSet.has(category.id)) {
      return;
    }

    if (activeTypeId && lastAutoTypeRef.current === activeTypeId) {
      return;
    }

    const categoryIndex = activeLineageIds.indexOf(category.id);
    if (categoryIndex === -1) {
      return;
    }

    const nextGroupId = activeLineageIds[categoryIndex + 1] ?? null;
    if (nextGroupId) {
      if (openGroupId !== nextGroupId) {
        setOpenGroupId(nextGroupId);
      }
    } else if (openGroupId !== null) {
      setOpenGroupId(null);
    }

    lastAutoTypeRef.current = activeTypeId ?? null;
  }, [activeLineageIds, activeLineageSet, activeTypeId, category.id, open, openGroupId]);

  useEffect(() => {
    if (!targetLineage || targetLineage[0] !== category.id) {
      return;
    }

    if (!open) {
      setOpenCategoryId(category.id);
    }

    const [, ...rest] = targetLineage;
    if (rest.length === 0) {
      onTargetConsumed();
      return;
    }

    const nextGroupId = rest[0] ?? null;
    if (nextGroupId) {
      setOpenGroupId(nextGroupId);
    }
  }, [category.id, onTargetConsumed, open, setOpenCategoryId, targetLineage]);

  return (
    <li className={styles.category} data-open={open || undefined}>
      <button className={styles.categoryButton} type="button" aria-expanded={open} onClick={toggle}>
        <span className={styles.caret} aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className={styles.icon} aria-hidden="true">{getCategoryIcon(category.name)}</span>
        <span className={styles.label}>{category.name}</span>
      </button>
      {open && (
        <ul className={styles.groupList} role="list">
          {category.groups.map((g) => (
            <GroupNode
              key={g.id}
              group={g}
              parentLabel={category.name}
              onSelectType={onSelectType}
              activeTypeId={activeTypeId}
              openGroupId={openGroupId}
              setOpenGroupId={setOpenGroupId}
              activeLineageIds={activeLineageIds}
              activeLineageSet={activeLineageSet}
              targetLineage={targetLineage && targetLineage[0] === category.id ? targetLineage.slice(1) : null}
              onTargetConsumed={onTargetConsumed}
              onUserInteraction={onUserInteraction}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function MarketAccordion() {
  if ((import.meta as any).env?.VITE_DISABLE_TAXONOMY_ACCORDION === '1') {
    return null;
  }

  const activeTypeId = useMarketBrowserStore((s) => s.activeTypeId);
  const pendingLineage = useMarketBrowserStore((s) => s.pendingLineage);
  const lineageToken = useMarketBrowserStore((s) => s.lineageToken);
  const clearLineageRequest = useMarketBrowserStore((s) => s.clearLineageRequest);
  const selectTaxonomyType = useSelectTaxonomyType();

  const { data, isFetching, isPending } = useQuery({
    queryKey: ['taxonomy', ''],
    queryFn: () => fetchTaxonomy(''),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const networkCategories = useMemo(() => sanitizeCategories(data?.categories ?? null), [data?.categories]);

  const [cachedCategories, setCachedCategories] = useState<TaxonomyCategory[]>(() => readCachedCategories());
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [targetLineage, setTargetLineage] = useState<string[] | null>(null);
  const [processedToken, setProcessedToken] = useState<number>(0);
  const [autoReveal, setAutoReveal] = useState<boolean>(true);
  const lastActiveTypeRef = useRef<string | null>(null);

  useEffect(() => {
    if (networkCategories.length === 0) {
      return;
    }
    setCachedCategories(networkCategories);
    writeCachedCategories(networkCategories);
  }, [networkCategories]);

  const displayCategories = useMemo(() => {
    if (networkCategories.length > 0) {
      return networkCategories;
    }

    return cachedCategories;
  }, [cachedCategories, networkCategories]);

  const handleSelectType = useCallback(
    (type: TaxonomyType) => {
      selectTaxonomyType(type);
    },
    [selectTaxonomyType]
  );

  const activeLookup = useMemo(() => findActiveType(displayCategories, activeTypeId), [displayCategories, activeTypeId]);
  const activeLineage = activeLookup?.lineageIds ?? [];
  const activeLineageSet = useMemo(() => new Set(activeLineage), [activeLineage]);

  useEffect(() => {
    if (!pendingLineage || lineageToken === processedToken) {
      return;
    }

    const accordionLineage = buildAccordionLineage(pendingLineage, displayCategories);

    setProcessedToken(lineageToken);

    if (accordionLineage.length === 0) {
      setTargetLineage(null);
      clearLineageRequest();
      return;
    }

    setTargetLineage(accordionLineage);
    setOpenCategoryId(accordionLineage[0] ?? null);
    setAutoReveal(true);
    clearLineageRequest();
  }, [clearLineageRequest, displayCategories, lineageToken, pendingLineage, processedToken]);

  useEffect(() => {
    if (activeTypeId && lastActiveTypeRef.current !== activeTypeId) {
      lastActiveTypeRef.current = activeTypeId;
      setAutoReveal(true);
    }
  }, [activeTypeId]);

  useEffect(() => {
    if (targetLineage) {
      return;
    }
    if (!autoReveal) {
      return;
    }
    if (!activeLineage.length) {
      return;
    }
    const nextCategoryId = activeLineage[0];
    if (!nextCategoryId) {
      return;
    }
    if (openCategoryId !== nextCategoryId) {
      setOpenCategoryId(nextCategoryId);
    } else {
      setAutoReveal(false);
    }
  }, [activeLineage, autoReveal, openCategoryId, targetLineage]);

  const handleTargetConsumed = useCallback(() => {
    setTargetLineage(null);
    setAutoReveal(false);
  }, []);

  const handleUserInteraction = useCallback(() => {
    setAutoReveal(false);
    setTargetLineage(null);
  }, []);

  const showSkeleton = displayCategories.length === 0 && (isPending || isFetching);
  const showEmptyState = displayCategories.length === 0 && !showSkeleton;

  return (
    <nav className={styles.accordionNav} aria-label="Market categories">
      {showSkeleton ? (
        <ul className={styles.skeletonList} role="list" aria-label="Loading market categories">
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className={styles.categorySkeleton}>
              <span className={styles.skeletonCaret} aria-hidden="true" />
              <span className={styles.skeletonBlock} aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : showEmptyState ? (
        <p className={styles.emptyMessage} role="status">
          Additional categories are ingesting. Try search or pinned items in the meantime.
        </p>
      ) : (
        <ul className={styles.categoryList} role="list">
          {displayCategories.map((c) => (
            <CategoryNode
              key={c.id}
              category={c}
              onSelectType={handleSelectType}
              activeTypeId={activeTypeId}
              openCategoryId={openCategoryId}
              setOpenCategoryId={setOpenCategoryId}
              activeLineageIds={activeLineage}
              activeLineageSet={activeLineageSet}
              targetLineage={targetLineage}
              onTargetConsumed={handleTargetConsumed}
              onUserInteraction={handleUserInteraction}
            />
          ))}
        </ul>
      )}
    </nav>
  );
}
