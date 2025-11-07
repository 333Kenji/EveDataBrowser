import type { ItemDetailRecord } from '../../state/dropdown-store';

interface ItemDetailLineageProps {
  path: ItemDetailRecord['marketLineage'];
  onRevealLineage?: (ids: string[]) => void;
}

export function ItemDetailLineage({ path, onRevealLineage }: ItemDetailLineageProps) {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }

  type NormalizedNode = { id: string; name: string };

  const normalized: NormalizedNode[] = [];
  const seenIds = new Set<string>();

  for (const raw of path) {
    if (!raw) {
      continue;
    }

    const id = typeof raw.id === 'string' && raw.id.trim().length > 0
      ? raw.id.trim()
      : raw.id !== undefined && raw.id !== null
        ? String(raw.id)
        : null;

    const name = typeof raw.name === 'string' ? raw.name.trim() : '';

    if (!id || name.length === 0 || seenIds.has(id)) {
      continue;
    }

    normalized.push({ id, name });
    seenIds.add(id);
  }

  if (normalized.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Market hierarchy" className="item-detail__lineage">
      <ol className="item-detail__lineageList">
        {normalized.map((node, index) => {
          const isLast = index === normalized.length - 1;
          const lineageSlice = normalized.slice(0, index + 1).map((segment) => segment.id);
          const handleClick = () => {
            if (!isLast && typeof onRevealLineage === 'function') {
              onRevealLineage([...lineageSlice]);
            }
          };

          return (
            <li key={node.id} className="item-detail__lineageItem" data-depth={index}>
              {isLast ? (
                <span className="item-detail__lineageCurrent" aria-current="page">
                  {node.name}
                </span>
              ) : (
                <button
                  type="button"
                  className="item-detail__lineageButton"
                  onClick={handleClick}
                  aria-label={`Reveal ${node.name} lineage`}
                >
                  {node.name}
                </button>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="item-detail__lineageDivider">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
