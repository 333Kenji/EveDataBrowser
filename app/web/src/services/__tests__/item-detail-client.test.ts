import { describe, expect, it } from 'vitest';
import { buildMarketLineage } from '../item-detail-client';

describe('buildMarketLineage', () => {
  it('returns taxonomy-friendly ids with category heading first', () => {
    const path = buildMarketLineage({
      name: 'Frigates',
      key: 1362,
      path: [
        { marketGroupKey: 1361, marketGroupId: 1361, name: 'Ships', parentGroupKey: null },
        { marketGroupKey: 1362, marketGroupId: 1362, name: 'Frigates', parentGroupKey: 1361 },
        { marketGroupKey: 2001, marketGroupId: 2001, name: 'Combat', parentGroupKey: 1362 },
      ],
    } as any);

    expect(path).toEqual([
      { id: 'market-category-1361', name: 'Ships' },
      { id: 'market-group-1362', name: 'Frigates' },
      { id: 'market-group-2001', name: 'Combat' },
    ]);
  });

  it('falls back to category slug when keys are missing', () => {
    const lineage = buildMarketLineage({
      name: 'Unknown',
      key: null,
      path: [
        { marketGroupKey: null, marketGroupId: null, name: 'Abyssal Ships', parentGroupKey: null },
      ],
    } as any);

    expect(lineage[0].id.startsWith('market-category-')).toBe(true);
    expect(lineage[0].name).toBe('Abyssal Ships');
  });
});
