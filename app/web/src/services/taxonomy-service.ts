import { z } from 'zod';
import { buildApiUrl, resolveApiBases } from './api-base';
import { slugify } from '../utils/slugify';

const DEFAULT_SEARCH_LIMIT = 100;
const MAX_BROWSE_PAGES = 400;
const UNCATEGORIZED_NAME = 'Uncategorized';
const UNCATEGORIZED_CATEGORY_ID = 'market-category-uncategorized';
const UNCATEGORIZED_GROUP_ID = 'market-group-uncategorized';
const UNCATEGORIZED_GROUP_NAME = 'Unassigned';

const marketGroupPathEntrySchema = z.object({
  marketGroupKey: z.number(),
  marketGroupId: z.number().nullable(),
  name: z.string().nullable(),
  parentGroupKey: z.number().nullable(),
});

const marketGroupPathSchema = z.array(marketGroupPathEntrySchema).optional().default([]);

const apiItemSchema = z.object({
  typeId: z.number(),
  name: z.string(),
  groupId: z.number().nullable(),
  groupName: z.string().nullable(),
  categoryId: z.number().nullable(),
  categoryName: z.string().nullable(),
  metaGroupId: z.number().nullable(),
  metaGroupName: z.string().nullable(),
  marketGroupKey: z.number().nullable(),
  marketGroupId: z.number().nullable(),
  marketGroupName: z.string().nullable(),
  marketGroupPath: marketGroupPathSchema,
  isBlueprintManufactured: z.boolean(),
  published: z.boolean(),
});

const apiResponseSchema = z.object({
  items: z.array(apiItemSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
  }),
});

type ApiItem = z.infer<typeof apiItemSchema>;
export type TaxonomyApiItem = ApiItem;
type MarketGroupPathEntry = z.infer<typeof marketGroupPathEntrySchema>;

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export interface TaxonomyType {
  id: string;
  typeId: string;
  name: string;
  groupId: string;
  groupName: string;
  categoryId: string;
  categoryName: string;
  lineage: Array<{ id: string; name: string }>;
  metaGroupId: number | null;
  metaGroupName?: string | null;
  isBlueprintManufactured: boolean;
  published: boolean;
  thumbnailUrl?: string;
}

export interface TaxonomyGroup {
  id: string;
  name: string;
  categoryId: string;
  types: TaxonomyType[];
  parentId: string | null;
  depth: number;
  groups?: TaxonomyGroup[];
  metadata?: Record<string, unknown>;
}

export interface TaxonomyCategory {
  id: string;
  name: string;
  groups: TaxonomyGroup[];
  typeCount: number;
}

export interface TaxonomySearchResponse {
  categories: TaxonomyCategory[];
  dataVersion: string;
  latencyMs: number;
}

export interface TaxonomySuggestion {
  id: string;
  typeId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  groupId: string;
  groupName: string;
}

interface PageResult {
  items: ApiItem[];
  pagination: { limit: number; offset: number; total: number };
  dataVersion: string;
  baseUsed: string;
  latencyMs: number;
}

function resolveMarketGroupName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNCATEGORIZED_NAME;
}

function buildCategoryIdFromMarket(root: MarketGroupPathEntry | undefined): string {
  if (root && Number.isFinite(root.marketGroupKey)) {
    return `market-category-${root.marketGroupKey}`;
  }

  if (root?.name) {
    return `market-category-${slugify(root.name)}`;
  }

  return UNCATEGORIZED_CATEGORY_ID;
}

interface GroupIdContext {
  nodeKey: number | null | undefined;
  nodeName: string | null | undefined;
  parentId: string | null;
}

function buildGroupIdFromMarket({ nodeKey, nodeName, parentId }: GroupIdContext): string {
  if (nodeKey !== null && nodeKey !== undefined && Number.isFinite(nodeKey)) {
    return `market-group-${nodeKey}`;
  }

  const slug = slugify(nodeName ?? UNCATEGORIZED_GROUP_NAME);
  if (parentId) {
    return `${parentId}__${slug || 'unknown'}`;
  }

  return `market-group-${slug || 'uncategorized'}`;
}

interface GroupAccumulator {
  id: string;
  name: string;
  categoryId: string;
  parentId: string | null;
  depth: number;
  types: TaxonomyType[];
  groups: Map<string, GroupAccumulator>;
}

interface CategoryAccumulator {
  id: string;
  name: string;
  groups: Map<string, GroupAccumulator>;
}

function createGroupAccumulator(props: {
  id: string;
  name: string;
  categoryId: string;
  parentId: string | null;
  depth: number;
}): GroupAccumulator {
  return {
    ...props,
    types: [],
    groups: new Map(),
  };
}

function ensureGroup(
  container: Map<string, GroupAccumulator>,
  node: MarketGroupPathEntry,
  categoryId: string,
  parentId: string | null,
  depth: number,
): GroupAccumulator {
  const name = resolveMarketGroupName(node.name);
  const id = buildGroupIdFromMarket({ nodeKey: node.marketGroupKey, nodeName: name, parentId });
  let group = container.get(id);
  if (!group) {
    group = createGroupAccumulator({ id, name, categoryId, parentId, depth });
    container.set(id, group);
  }
  return group;
}

function ensureFallbackGroup(category: CategoryAccumulator): GroupAccumulator {
  const existing = category.groups.get(UNCATEGORIZED_GROUP_ID);
  if (existing) {
    return existing;
  }

  const fallback = createGroupAccumulator({
    id: UNCATEGORIZED_GROUP_ID,
    name: UNCATEGORIZED_GROUP_NAME,
    categoryId: category.id,
    parentId: null,
    depth: 0,
  });

  category.groups.set(UNCATEGORIZED_GROUP_ID, fallback);
  return fallback;
}

function buildThumbnail(typeId: number): string {
  return `https://images.evetech.net/types/${typeId}/icon?size=64`;
}

function filterItems(items: ApiItem[]): ApiItem[] {
  return items.filter((item) => item.published && item.isBlueprintManufactured);
}

export function buildTaxonomyCategories(items: ApiItem[]): TaxonomyCategory[] {
  const categories = new Map<string, CategoryAccumulator>();

  for (const item of items) {
    const marketPath = item.marketGroupPath ?? [];
    const rootNode = marketPath[0];
    const categoryId = buildCategoryIdFromMarket(rootNode);
    const categoryName = resolveMarketGroupName(rootNode?.name ?? item.marketGroupName ?? UNCATEGORIZED_NAME);

    let category = categories.get(categoryId);
    if (!category) {
      category = {
        id: categoryId,
        name: categoryName,
        groups: new Map<string, GroupAccumulator>(),
      };
      categories.set(categoryId, category);
    }

    const lineage: Array<{ id: string; name: string }> = [{ id: category.id, name: category.name }];

    let currentGroup: GroupAccumulator;
    if (marketPath.length === 0) {
      currentGroup = ensureFallbackGroup(category);
      lineage.push({ id: currentGroup.id, name: currentGroup.name });
    } else {
      currentGroup = ensureGroup(category.groups, marketPath[0], category.id, null, 0);
      lineage.push({ id: currentGroup.id, name: currentGroup.name });

      for (let index = 1; index < marketPath.length; index += 1) {
        const node = marketPath[index];
        currentGroup = ensureGroup(currentGroup.groups, node, category.id, currentGroup.id, index);
        lineage.push({ id: currentGroup.id, name: currentGroup.name });
      }
    }

    const typeId = String(item.typeId);
    if (currentGroup.types.some((type) => type.id === typeId)) {
      continue;
    }

    currentGroup.types.push({
      id: typeId,
      typeId,
      name: item.name,
      groupId: currentGroup.id,
      groupName: currentGroup.name,
      categoryId: category.id,
      categoryName: category.name,
      lineage,
      metaGroupId: item.metaGroupId ?? null,
      metaGroupName: item.metaGroupName ?? null,
      isBlueprintManufactured: item.isBlueprintManufactured,
      published: item.published,
      thumbnailUrl: buildThumbnail(item.typeId),
    });
  }

  const collator = new Intl.Collator('en', { sensitivity: 'base' });

  function sortTypes(types: TaxonomyType[]): TaxonomyType[] {
    return [...types].sort((a, b) => collator.compare(a.name, b.name));
  }

  function materializeGroup(group: GroupAccumulator): TaxonomyGroup | null {
    if (group.id === UNCATEGORIZED_GROUP_ID) {
      return null;
    }

    const nestedGroups = Array.from(group.groups.values())
      .map(materializeGroup)
      .filter((child): child is TaxonomyGroup => child !== null)
      .sort((a, b) => collator.compare(a.name, b.name));

    const visibleTypes = sortTypes(group.types);
    if (visibleTypes.length === 0 && nestedGroups.length === 0) {
      return null;
    }

    return {
      id: group.id,
      name: group.name,
      categoryId: group.categoryId,
      parentId: group.parentId,
      depth: group.depth,
      types: visibleTypes,
      groups: nestedGroups.length > 0 ? nestedGroups : undefined,
    } satisfies TaxonomyGroup;
  }

  function countTypes(group: TaxonomyGroup): number {
    const nested = (group.groups ?? []).reduce((total, child) => total + countTypes(child), 0);
    return group.types.length + nested;
  }

  const visibleCategories = Array.from(categories.values())
    .map((category) => {
      const groups = Array.from(category.groups.values())
        .map(materializeGroup)
        .filter((group): group is TaxonomyGroup => group !== null)
        .sort((a, b) => collator.compare(a.name, b.name));

      const typeCount = groups.reduce((total, group) => total + countTypes(group), 0);

      if (category.id === UNCATEGORIZED_CATEGORY_ID || typeCount === 0) {
        return null;
      }

      return {
        id: category.id,
        name: category.name,
        groups,
        typeCount,
      } satisfies TaxonomyCategory;
    })
    .filter((category): category is TaxonomyCategory => category !== null)
    .sort((a, b) => collator.compare(a.name, b.name));

  return visibleCategories;
}

async function fetchPage(query: string, offset: number, preferredBase?: string): Promise<PageResult> {
  const bases = resolveApiBases();
  const orderedBases = preferredBase ? [preferredBase, ...bases.filter((candidate) => candidate !== preferredBase)] : bases;
  const start = nowMs();
  let lastError: unknown;

  for (const base of orderedBases) {
    try {
      const url = buildApiUrl(
        '/v1/taxonomy/search',
        {
          q: query || undefined,
          limit: DEFAULT_SEARCH_LIMIT,
          offset: offset > 0 ? offset : undefined,
        },
        base,
      );

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`taxonomy request failed (${response.status})`);
      }

      const body = apiResponseSchema.parse(await response.json());
      const dataVersion =
        response.headers.get('etag') ||
        response.headers.get('last-modified') ||
        response.headers.get('date') ||
        'unknown';

      return {
        items: body.items,
        pagination: body.pagination,
        dataVersion,
        baseUsed: base,
        latencyMs: Math.max(0, nowMs() - start),
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Unable to load taxonomy search results');
}

export async function fetchTaxonomy(rawQuery: string): Promise<TaxonomySearchResponse> {
  const query = rawQuery.trim();
  const start = nowMs();

  const aggregated: ApiItem[] = [];
  let offset = 0;
  let baseUsed: string | undefined;
  let dataVersion = 'unknown';
  let totalLatency = 0;
  const pageLimit = query ? 1 : MAX_BROWSE_PAGES;

  for (let page = 0; page < pageLimit; page += 1) {
    const pageResult = await fetchPage(query, offset, baseUsed);
    aggregated.push(...filterItems(pageResult.items));
    baseUsed = pageResult.baseUsed;
    dataVersion = pageResult.dataVersion;
    totalLatency += pageResult.latencyMs;

    const { limit, offset: responseOffset, total } = pageResult.pagination;
    const nextOffset = responseOffset + limit;
    if (nextOffset >= total || pageResult.items.length < limit) {
      break;
    }

    offset = nextOffset;
    if (!query && page === pageLimit - 1) {
      console.warn('[taxonomy] reached browse page cap; additional results may be truncated');
    }
  }

  const categories = buildTaxonomyCategories(aggregated);

  if (process.env.NODE_ENV !== 'production') {
    console.log('[taxonomy] fetched items', {
      query,
      totalRecords: aggregated.length,
      categoryCount: categories.length,
      sampleCategories: categories.slice(0, 3).map((category) => ({
        name: category.name,
        groups: category.groups.length,
        typeCount: category.typeCount,
      })),
    });

    if (typeof window !== 'undefined') {
      // @ts-expect-error debug hook for headless assertions
      window.__taxonomyDebug = {
        query,
        totalRecords: aggregated.length,
        categoryCount: categories.length,
        typeCounts: categories.map((category) => ({ name: category.name, count: category.typeCount })),
      };
    }
  }

  return {
    categories,
    dataVersion,
    latencyMs: Math.max(0, totalLatency || nowMs() - start),
  };
}

export async function fetchTaxonomySuggestions(rawQuery: string, limit = 10): Promise<TaxonomySuggestion[]> {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }

  const page = await fetchPage(query, 0);
  const filtered = filterItems(page.items).slice(0, limit);

  return filtered.map<TaxonomySuggestion>((item) => {
    const marketPath = item.marketGroupPath ?? [];
    const categoryId = buildCategoryIdFromMarket(marketPath[0]);
    const categoryName = resolveMarketGroupName(marketPath[0]?.name ?? item.marketGroupName ?? UNCATEGORIZED_NAME);
    const groupId = buildGroupIdFromMarket({ nodeKey: item.marketGroupKey, nodeName: item.marketGroupName, parentId: null });
    const groupName = resolveMarketGroupName(item.marketGroupName);
    const typeId = String(item.typeId);
    return {
      id: typeId,
      typeId,
      name: item.name,
      categoryId,
      categoryName,
      groupId,
      groupName,
    } satisfies TaxonomySuggestion;
  });
}
