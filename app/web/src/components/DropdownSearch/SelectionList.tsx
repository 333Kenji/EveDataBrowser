import type { SelectionListProps } from './types';
import { dropdownSelectionClass } from './motif.css.ts';

export function SelectionList({
  selections,
  onRemove,
  onReorder,
  onClear,
  onFocus,
  activeSelectionId,
  pinnedSelectionId,
}: SelectionListProps) {
  if (selections.length === 0) {
    return (
      <p className="dropdown-selection__empty" role="status">
        No items selected yet. Pick a type to build your shortlist.
      </p>
    );
  }

  const selectionCountLabel = `${selections.length} item${selections.length === 1 ? '' : 's'} selected`;

  const formatSelectionSummary = (selection: SelectionListProps['selections'][number]): string => {
    const category = selection.categoryName ? selection.categoryName.toLowerCase() : selection.categoryId;
  const groupSource = selection.groupSummaryName ?? selection.groupName;
  const group = groupSource ? groupSource.toLowerCase() : selection.groupId;
    return `${selection.label} — category ${category}, group ${group}`;
  };

  return (
    <div className="dropdown-selection" role="region" aria-labelledby="dropdown-selection-heading">
      <div className="dropdown-selection__header">
        <h4 id="dropdown-selection-heading">Shortlist</h4>
        <span id="dropdown-selection-count" aria-live="polite" className="dropdown-selection__count">
          {selectionCountLabel}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="dropdown-selection__clear"
          aria-describedby="dropdown-selection-count"
        >
          Clear all
        </button>
      </div>
      <ul className="dropdown-selection__list" role="list">
        {selections.map((selection, index) => {
          const isActive = activeSelectionId === selection.id;
          const isPinned = pinnedSelectionId === selection.id;

          return (
            <li
              key={selection.id}
              className={`${dropdownSelectionClass} dropdown-selection__item`}
              data-active={isActive}
              data-pinned={isPinned}
            >
              <button
                type="button"
                className="dropdown-selection__focus"
                onClick={() => onFocus?.(selection.id)}
                aria-pressed={isActive}
              >
                <span className="dropdown-selection__label">{formatSelectionSummary(selection)}</span>
                {isPinned && <span className="dropdown-selection__badge">Pinned</span>}
              </button>
            <div className="dropdown-selection__actions">
              <button
                type="button"
                onClick={() => onReorder(index, Math.max(index - 1, 0))}
                aria-label={`Move ${selection.label} up`}
                disabled={index === 0}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onReorder(index, Math.min(index + 1, selections.length - 1))}
                aria-label={`Move ${selection.label} down`}
                disabled={index === selections.length - 1}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onRemove(selection.id)}
                aria-label={`Remove ${selection.label}`}
              >
                ✕
              </button>
            </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
