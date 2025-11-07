import fs from 'node:fs';

const UNCATEGORIZED_NAME = 'Uncategorized';
const UNCATEGORIZED_CATEGORY_ID = 'market-category-uncategorized';
const UNCATEGORIZED_GROUP_ID = 'market-group-uncategorized';
const UNCATEGORIZED_GROUP_NAME = 'Unassigned';

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function resolveMarketGroupName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.length > 0 ? trimmed : UNCATEGORIZED_NAME;
}

function buildCategoryIdFromMarket(root) {
  if (root && Number.isFinite(root.marketGroupKey)) {
    return `market-category-${root.marketGroupKey}`;
  }
  if (root && root.name) {
    return `market-category-${slugify(root.name)}`;
  }
  return UNCATEGORIZED_CATEGORY_ID;
}

function buildGroupIdFromMarket({ nodeKey, nodeName, parentId }) {
  if (nodeKey !== null && nodeKey !== undefined && Number.isFinite(nodeKey)) {
    return `market-group-${nodeKey}`;
  }
  const slug = slugify(nodeName ?? UNCATEGORIZED_GROUP_NAME);
  if (parentId) {
    return `${parentId}__${slug || 'unknown'}`;
  }
  return `market-group-${slug || 'uncategorized'}`;
}

function createGroupAccumulator({ id, name, categoryId, parentId, depth }) {
  return {
    id,
    name,
    categoryId,
    parentId,
    depth,
    types: [],
    groups: new Map(),
  };
}

function ensureGroup(container, node, categoryId, parentId, depth) {
  const name = resolveMarketGroupName(node?.name);
  const id = buildGroupIdFromMarket({ nodeKey: node?.marketGroupKey, nodeName: name, parentId });
  let group = container.get(id);
  if (!group) {
    group = createGroupAccumulator({ id, name, categoryId, parentId, depth });
    container.set(id, group);
  }
  return group;
}

function ensureFallbackGroup(category) {
  if (category.groups.has(UNCATEGORIZED_GROUP_ID)) {
    return category.groups.get(UNCATEGORIZED_GROUP_ID);
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

function collectVisibleCategories(items) {
  const categories = new Map();

  for (const item of items) {
    const marketPath = Array.isArray(item.marketGroupPath) ? item.marketGroupPath : [];
    const rootNode = marketPath[0];
    const categoryId = buildCategoryIdFromMarket(rootNode);
    const categoryName = resolveMarketGroupName(rootNode?.name ?? item.marketGroupName ?? UNCATEGORIZED_NAME);

    let category = categories.get(categoryId);
    if (!category) {
      category = {
        id: categoryId,
        name: categoryName,
        groups: new Map(),
      };
      categories.set(categoryId, category);
    }

    const lineage = [{ id: category.id, name: category.name }];

    let currentGroup;
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
      isBlueprintManufactured: Boolean(item.isBlueprintManufactured),
      published: Boolean(item.published),
    });
  }

  const collator = new Intl.Collator('en', { sensitivity: 'base' });

  function sortTypes(types) {
    return [...types].sort((a, b) => collator.compare(a.name, b.name));
  }

  function materializeGroup(group) {
    if (group.id === UNCATEGORIZED_GROUP_ID) {
      return null;
    }

    const nestedGroups = Array.from(group.groups.values())
      .map(materializeGroup)
      .filter(Boolean)
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
    };
  }

  function countTypes(group) {
    const nested = (group.groups ?? []).reduce((total, child) => total + countTypes(child), 0);
    return group.types.length + nested;
  }

  const visibleCategories = Array.from(categories.values())
    .map((category) => {
      const groups = Array.from(category.groups.values())
        .map(materializeGroup)
        .filter(Boolean)
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => collator.compare(a.name, b.name));

  return visibleCategories;
}

const rootData = JSON.parse(
  fs.readFileSync(
    new URL(
      '../test-results/e2e-dropdown-search-dropdo-6255a--and-shortlist-interactions-chromium/trace/resources/1cea8e3b09cfd24a1f5d22df6171e5d399513b6b.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const atrData = JSON.parse(
  fs.readFileSync(
    new URL(
      '../test-results/e2e-dropdown-search-dropdo-6255a--and-shortlist-interactions-chromium/trace/resources/9d4162504141b19af8b5f8da4c6dd67a2feb7d40.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

const rootCategories = collectVisibleCategories(rootData.items);
const atrCategories = collectVisibleCategories(atrData.items);

console.log('root categories', rootCategories.map((c) => ({ name: c.name, typeCount: c.typeCount })));
console.log('atr categories', atrCategories.map((c) => ({ name: c.name, typeCount: c.typeCount })));
console.log('root groups detail', JSON.stringify(rootCategories, null, 2));
console.log('atr detail', JSON.stringify(atrCategories, null, 2));
