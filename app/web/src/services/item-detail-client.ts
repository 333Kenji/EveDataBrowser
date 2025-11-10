import { z } from 'zod';
import type { ItemDetailAttribute, ItemDetailRecord } from '../state/dropdown-store';
import { slugify } from '../utils/slugify';
import { buildApiUrl } from './api-base';

const blueprintSchema = z
  .object({
    typeId: z.number().nullable(),
    name: z.string().nullable(),
    activity: z.string().nullable(),
    productQuantity: z.number().nullable(),
    manufacturingTime: z.number().nullable(),
    maxProductionLimit: z.number().nullable(),
  })
  .nullable();

const materialSchema = z.object({
  materialTypeId: z.number(),
  materialName: z.string().nullable(),
  quantity: z.number(),
  groupId: z.number().nullable(),
  groupName: z.string().nullable(),
});

const marketGroupPathEntrySchema = z.object({
  marketGroupKey: z.number(),
  marketGroupId: z.number().nullable(),
  name: z.string().nullable(),
  parentGroupKey: z.number().nullable(),
});

const marketGroupSchema = z
  .object({
    id: z.number().nullable(),
    key: z.number().nullable().optional(),
    name: z.string().nullable(),
    path: z.array(marketGroupPathEntrySchema).optional().default([]),
  })
  .nullable()
  .optional();

const itemDetailSchema = z.object({
  typeId: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  published: z.boolean(),
  group: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    })
    .nullable()
    .default(null),
  category: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    })
    .nullable()
    .default(null),
  meta: z
    .object({
      groupId: z.number().nullable(),
      groupName: z.string().nullable(),
      metaLevel: z.number().nullable(),
    })
    .nullable()
    .default(null),
  marketGroup: marketGroupSchema,
  faction: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    })
    .nullable()
    .optional(),
  raceId: z.number().nullable().optional(),
  mass: z.number().nullable().optional(),
  volume: z.number().nullable().optional(),
  basePrice: z.number().nullable().optional(),
  blueprint: blueprintSchema,
  materials: z.array(materialSchema),
});

type ItemDetailPayload = z.infer<typeof itemDetailSchema>;
type MarketGroupPayload = z.infer<typeof marketGroupSchema>;

function buildAttributes(detail: ItemDetailPayload): ItemDetailAttribute[] {
  const attributes: ItemDetailAttribute[] = [];

  if (detail.meta?.metaLevel != null) {
    attributes.push({ label: 'Meta Level', value: detail.meta.metaLevel, importance: 'core' });
  }

  if (detail.basePrice != null) {
    attributes.push({ label: 'Base Price', value: detail.basePrice, importance: 'secondary' });
  }

  if (detail.volume != null) {
    attributes.push({ label: 'Volume', value: detail.volume, unit: 'm³', importance: 'secondary' });
  }

  if (detail.mass != null) {
    attributes.push({ label: 'Mass', value: detail.mass, unit: 'kg', importance: 'secondary' });
  }

  if (detail.blueprint?.manufacturingTime != null) {
    attributes.push({ label: 'Manufacturing Time', value: detail.blueprint.manufacturingTime, unit: 's', importance: 'secondary' });
  }

  if (detail.blueprint?.productQuantity != null) {
    attributes.push({ label: 'Output Quantity', value: detail.blueprint.productQuantity, importance: 'secondary' });
  }

  return attributes;
}

export function buildMarketLineage(group: MarketGroupPayload | null): Array<{ id: string; name: string }> {
  if (!group) {
    return [];
  }

  const path = Array.isArray(group.path) ? group.path : [];
  if (path.length === 0) {
    const fallbackName = group.name?.trim();
    if (!fallbackName) {
      return [];
    }
    const baseId = group.key != null ? `market-category-${group.key}` : `market-category-${slugify(fallbackName) || 'fallback'}`;
    return [{ id: baseId, name: fallbackName }];
  }

  return path.map((node, index) => {
    const key = Number.isFinite(node.marketGroupKey) ? Number(node.marketGroupKey) : null;
    const name = node.name?.trim() ?? 'Unknown';
    if (index === 0) {
      const categoryId = key != null ? `market-category-${key}` : `market-category-${slugify(name) || index}`;
      return { id: categoryId, name };
    }

    const groupId = key != null ? `market-group-${key}` : `market-group-fallback-${index}`;
    return { id: groupId, name };
  });
}

function mapDetail(payload: ItemDetailPayload, dataVersion: string): ItemDetailRecord {
  const typeId = String(payload.typeId);
  const categoryName = payload.category?.name ?? 'Uncategorized';
  const groupName = payload.group?.name ?? 'Unknown';
  const marketLineage = buildMarketLineage(payload.marketGroup ?? null);

  return {
    typeId,
    name: payload.name,
    category: categoryName,
    group: groupName,
    description: payload.description ?? undefined,
    imageUrl: `https://images.evetech.net/types/${payload.typeId}/icon?size=256`,
    dataVersion,
    lastUpdated: new Date().toISOString(),
    attributes: buildAttributes(payload),
    isPartial: false,
    marketLineage,
  } satisfies ItemDetailRecord;
}

export async function fetchItemDetail(typeId: string): Promise<ItemDetailRecord> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const url = buildApiUrl(`/v1/items/${encodeURIComponent(typeId)}`);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = itemDetailSchema.parse(await response.json());
    const dataVersion = response.headers.get('last-modified') ?? response.headers.get('date') ?? 'unknown';
    return mapDetail(payload, dataVersion);
  } finally {
    clearTimeout(timeout);
  }
}
