import { describe, expect, it } from 'vitest';
import { buildTaxonomyCategories, type TaxonomyApiItem, type TaxonomyGroup } from '../taxonomy-service';

type ItemOverrides = Partial<TaxonomyApiItem> & Pick<TaxonomyApiItem, 'typeId' | 'name'>;

function createItem(overrides: ItemOverrides): TaxonomyApiItem {
  const basePath = [
    { marketGroupKey: 1361, marketGroupId: 1361, name: 'Ships', parentGroupKey: null },
    { marketGroupKey: 1362, marketGroupId: 1362, name: 'Frigates', parentGroupKey: 1361 },
  ];

  return {
    typeId: overrides.typeId,
    name: overrides.name,
    groupId: overrides.groupId ?? 25,
    groupName: overrides.groupName ?? 'Frigates',
    categoryId: overrides.categoryId ?? 6,
    categoryName: overrides.categoryName ?? 'Ships',
    metaGroupId: overrides.metaGroupId ?? null,
    metaGroupName: overrides.metaGroupName ?? null,
    marketGroupKey: overrides.marketGroupKey ?? 1362,
    marketGroupId: overrides.marketGroupId ?? 1362,
    marketGroupName: overrides.marketGroupName ?? 'Frigates',
    marketGroupPath: overrides.marketGroupPath ?? basePath,
    isBlueprintManufactured: overrides.isBlueprintManufactured ?? true,
    published: overrides.published ?? true,
  } satisfies TaxonomyApiItem;
}

function collectTypeNames(groups: TaxonomyGroup[]): string[] {
  const names: string[] = [];

  for (const group of groups) {
    for (const type of group.types ?? []) {
      names.push(type.name);
    }
    if (group.groups) {
      names.push(...collectTypeNames(group.groups));
    }
  }

  return names;
}

describe('buildTaxonomyCategories', () => {
  it('filters uncategorized fallback buckets from browse data', () => {
    const visibleItem = createItem({ typeId: 34, name: 'Atron' });
    const hiddenItem = createItem({
      typeId: 55,
      name: 'Prototype Hull',
      marketGroupKey: null,
      marketGroupId: null,
      marketGroupName: null,
      marketGroupPath: [],
    });

    const categories = buildTaxonomyCategories([visibleItem, hiddenItem]);

    expect(categories).toHaveLength(1);
    const category = categories[0];
  expect(category.groups).toHaveLength(1);
  expect(category.groups[0].id).not.toBe('market-group-uncategorized');

  const visibleTypeNames = collectTypeNames(category.groups);
  expect(visibleTypeNames).toContain('Atron');
  expect(visibleTypeNames).not.toContain('Prototype Hull');
    expect(category.typeCount).toBe(1);
  });

  it('returns no categories when only uncategorized items are present', () => {
    const hiddenItem = createItem({
      typeId: 78,
      name: 'Unknown Blueprint',
      marketGroupKey: null,
      marketGroupId: null,
      marketGroupName: null,
      marketGroupPath: [],
    });

    const categories = buildTaxonomyCategories([hiddenItem]);

    expect(categories).toHaveLength(0);
  });
});
