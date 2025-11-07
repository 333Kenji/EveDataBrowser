import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTaxonomy } from './taxonomy-service';
import * as apiBase from './api-base';

function buildResponse(items: any[], pagination?: Partial<{ limit: number; offset: number; total: number }>) {
  return {
    items,
    pagination: {
      limit: 100,
      offset: 0,
      total: items.length,
      ...pagination,
    },
  };
}

describe('taxonomy-service functional behaviour', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).fetch;
  });

  it('falls back to the next base when the preferred base fails and groups results', async () => {
    vi.spyOn(apiBase, 'resolveApiBases').mockReturnValue(['http://localhost:9999', 'http://localhost:3000']);

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = new URL(String(input));

      if (url.origin === 'http://localhost:9999') {
        return {
          ok: false,
          status: 504,
          json: async () => ({}),
          headers: new Headers(),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () =>
          buildResponse([
            {
              typeId: 587,
              name: 'Rifter',
              categoryId: 6,
              categoryName: 'Ships',
              groupId: 25,
              groupName: 'Standard Frigate',
              metaGroupId: 1,
              metaGroupName: 'Tech I',
                  marketGroupKey: 1361,
                  marketGroupId: 1361,
                  marketGroupName: 'Standard Frigate',
                  marketGroupPath: [
                    {
                      marketGroupKey: 1,
                      marketGroupId: 1,
                      name: 'Ships',
                      parentGroupKey: null,
                    },
                    {
                      marketGroupKey: 1361,
                      marketGroupId: 1361,
                      name: 'Standard Frigate',
                      parentGroupKey: 1,
                    },
                  ],
              isBlueprintManufactured: true,
              published: true,
            },
            {
              typeId: 111,
              name: 'Federation Navy Comet',
              categoryId: 6,
              categoryName: 'Ships',
              groupId: 906,
              groupName: 'Faction Frigate',
              metaGroupId: 4,
              metaGroupName: 'Tech II',
                  marketGroupKey: 1365,
                  marketGroupId: 1365,
                  marketGroupName: 'Faction Frigate',
                  marketGroupPath: [
                    {
                      marketGroupKey: 1,
                      marketGroupId: 1,
                      name: 'Ships',
                      parentGroupKey: null,
                    },
                    {
                      marketGroupKey: 1365,
                      marketGroupId: 1365,
                      name: 'Faction Frigate',
                      parentGroupKey: 1,
                    },
                  ],
              isBlueprintManufactured: true,
              published: true,
            },
          ]),
        headers: new Headers({ date: 'Wed, 15 Jan 2025 12:00:00 GMT' }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchTaxonomy('');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[0][0])).origin).toBe('http://localhost:9999');
    expect(new URL(String(fetchMock.mock.calls[1][0])).origin).toBe('http://localhost:3000');
    expect(response.dataVersion).toBe('Wed, 15 Jan 2025 12:00:00 GMT');
    expect(response.categories).toHaveLength(1);
    expect(response.categories[0]?.groups).toHaveLength(1);
    const rootGroup = response.categories[0]?.groups[0];
    expect(rootGroup?.groups).toHaveLength(2);
    const totalTypes =
      rootGroup?.groups?.reduce((acc, group) => acc + group.types.length, 0) ?? 0;
    expect(totalTypes).toBe(2);
  });

  it('fetches subsequent pages until pagination total is exhausted', async () => {
    vi.spyOn(apiBase, 'resolveApiBases').mockReturnValue(['http://localhost:3000']);

    const pageOneItems = Array.from({ length: 100 }, (_, index) => ({
      typeId: index + 1,
      name: `Type ${index + 1}`,
      categoryId: 1,
      categoryName: 'Category',
      groupId: 10,
      groupName: 'Group',
      metaGroupId: null,
      metaGroupName: null,
      marketGroupKey: 5000 + index,
      marketGroupId: 5000 + index,
      marketGroupName: 'Group',
      marketGroupPath: [
        {
          marketGroupKey: 100,
          marketGroupId: 100,
          name: 'Category',
          parentGroupKey: null,
        },
        {
          marketGroupKey: 5000 + index,
          marketGroupId: 5000 + index,
          name: `Group ${index + 1}`,
          parentGroupKey: 100,
        },
      ],
      isBlueprintManufactured: true,
      published: true,
    }));

    const pageTwoItems = Array.from({ length: 5 }, (_, index) => ({
      typeId: 100 + index + 1,
      name: `Type ${100 + index + 1}`,
      categoryId: 1,
      categoryName: 'Category',
      groupId: 10,
      groupName: 'Group',
      metaGroupId: null,
      metaGroupName: null,
      marketGroupKey: 6000 + index,
      marketGroupId: 6000 + index,
      marketGroupName: 'Group',
      marketGroupPath: [
        {
          marketGroupKey: 100,
          marketGroupId: 100,
          name: 'Category',
          parentGroupKey: null,
        },
        {
          marketGroupKey: 6000 + index,
          marketGroupId: 6000 + index,
          name: `Group ${100 + index + 1}`,
          parentGroupKey: 100,
        },
      ],
      isBlueprintManufactured: true,
      published: true,
    }));

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get('offset') ?? '0');

      if (offset === 0) {
        return {
          ok: true,
          status: 200,
          json: async () => buildResponse(pageOneItems, { limit: 100, offset: 0, total: 105 }),
          headers: new Headers({ date: 'Wed, 15 Jan 2025 12:00:00 GMT' }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => buildResponse(pageTwoItems, { limit: 100, offset: 100, total: 105 }),
        headers: new Headers({ date: 'Wed, 15 Jan 2025 12:05:00 GMT' }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchTaxonomy('');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('offset')).toBe('100');
    const totalTypes = response.categories[0]?.typeCount ?? 0;
    expect(totalTypes).toBe(105);
  });

  it('filters unpublished or non-manufactured items before building categories', async () => {
    vi.spyOn(apiBase, 'resolveApiBases').mockReturnValue(['http://localhost:3000']);

    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () =>
          buildResponse([
            {
              typeId: 1,
              name: 'Published blueprint',
              categoryId: 2,
              categoryName: 'Modules',
              groupId: 20,
              groupName: 'Propulsion',
              metaGroupId: 1,
              metaGroupName: 'Tech I',
              marketGroupKey: 3000,
              marketGroupId: 3000,
              marketGroupName: 'Propulsion',
              marketGroupPath: [
                {
                  marketGroupKey: 10,
                  marketGroupId: 10,
                  name: 'Modules',
                  parentGroupKey: null,
                },
                {
                  marketGroupKey: 3000,
                  marketGroupId: 3000,
                  name: 'Propulsion',
                  parentGroupKey: 10,
                },
              ],
              isBlueprintManufactured: true,
              published: true,
            },
            {
              typeId: 2,
              name: 'Unpublished',
              categoryId: 2,
              categoryName: 'Modules',
              groupId: 21,
              groupName: 'Experimental',
              metaGroupId: 11,
              metaGroupName: 'Storyline',
              marketGroupKey: 3001,
              marketGroupId: 3001,
              marketGroupName: 'Experimental',
              marketGroupPath: [
                {
                  marketGroupKey: 10,
                  marketGroupId: 10,
                  name: 'Modules',
                  parentGroupKey: null,
                },
                {
                  marketGroupKey: 3001,
                  marketGroupId: 3001,
                  name: 'Experimental',
                  parentGroupKey: 10,
                },
              ],
              isBlueprintManufactured: true,
              published: false,
            },
            {
              typeId: 3,
              name: 'Non-manufactured',
              categoryId: 2,
              categoryName: 'Modules',
              groupId: 22,
              groupName: 'Prototype',
              metaGroupId: 12,
              metaGroupName: 'Special',
              marketGroupKey: 3002,
              marketGroupId: 3002,
              marketGroupName: 'Prototype',
              marketGroupPath: [
                {
                  marketGroupKey: 10,
                  marketGroupId: 10,
                  name: 'Modules',
                  parentGroupKey: null,
                },
                {
                  marketGroupKey: 3002,
                  marketGroupId: 3002,
                  name: 'Prototype',
                  parentGroupKey: 10,
                },
              ],
              isBlueprintManufactured: false,
              published: true,
            },
          ]),
        headers: new Headers({ date: 'Wed, 15 Jan 2025 12:00:00 GMT' }),
      } as Response),
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchTaxonomy('');

    expect(response.categories).toHaveLength(1);
    function flattenTypes(groups: any[]): any[] {
      return groups.flatMap((group) => {
        const nested = group.groups ? flattenTypes(group.groups) : [];
        return [...group.types, ...nested];
      });
    }

    const retainedTypes = flattenTypes(response.categories[0]?.groups ?? []);
    expect(retainedTypes).toHaveLength(1);
    expect(retainedTypes[0]?.name).toBe('Published blueprint');
  });
});
