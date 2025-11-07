import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchItemDetail } from './item-detail-client';

function buildPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    typeId: 12003,
    name: 'Vexor',
    description: 'Gallente combat cruiser',
    published: true,
    group: { id: 906, name: 'Combat Cruiser' },
    category: { id: 6, name: 'Ship' },
    meta: { groupId: 14, groupName: 'Tech II', metaLevel: 5 },
    marketGroup: {
      id: 61,
      key: 61,
      name: 'Cruisers',
      path: [
        { marketGroupKey: 4, marketGroupId: 4, name: 'Ships', parentGroupKey: null },
        { marketGroupKey: 61, marketGroupId: 61, name: 'Cruisers', parentGroupKey: 4 },
      ],
    },
    faction: null,
    raceId: 8,
    mass: 11300000,
    volume: 115000,
    basePrice: 8199990,
    blueprint: {
      typeId: 3353,
      name: 'Vexor Blueprint',
      activity: 'manufacturing',
      productQuantity: 1,
      manufacturingTime: 375000,
      maxProductionLimit: 200,
    },
    materials: [
      {
        materialTypeId: 34,
        materialName: 'Tritanium',
        quantity: 343500,
        groupId: 18,
        groupName: 'Mineral',
      },
    ],
    ...overrides,
  };
}

describe('item-detail-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).fetch;
  });

  it('maps API payloads into item detail records and returns dataVersion header', async () => {
    const payload = buildPayload();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
      headers: new Headers({ 'last-modified': 'Mon, 13 Oct 2025 15:20:00 GMT' }),
    })) as unknown as typeof fetch;

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchItemDetail('12003');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(requestUrl).toContain('/v1/items/12003');
    expect(result).toMatchObject({
      typeId: '12003',
      name: 'Vexor',
      category: 'Ship',
      group: 'Combat Cruiser',
      dataVersion: 'Mon, 13 Oct 2025 15:20:00 GMT',
      isPartial: false,
      marketLineage: [
        { id: 'market-category-4', name: 'Ships' },
        { id: 'market-group-61', name: 'Cruisers' },
      ],
    });
    expect(result.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Meta Level', value: 5 }),
        expect.objectContaining({ label: 'Base Price', value: 8199990 }),
        expect.objectContaining({ label: 'Manufacturing Time', value: 375000 }),
      ]),
    );
  });

  it('marks the response as partial when description or materials are missing', async () => {
    const payload = buildPayload({ description: null, materials: [] });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
      headers: new Headers({ date: 'Mon, 13 Oct 2025 15:45:00 GMT' }),
    })) as unknown as typeof fetch;

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchItemDetail('12003');

    expect(result.isPartial).toBe(true);
    expect(result.dataVersion).toBe('Mon, 13 Oct 2025 15:45:00 GMT');
  });

  it('throws when the API responds with an error status', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: 'error' }),
      headers: new Headers(),
    })) as unknown as typeof fetch;

    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchItemDetail('12003')).rejects.toThrow('Request failed with status 500');
  });
});
