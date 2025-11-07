import type { DropdownSelection } from '../../state/dropdown-store';

export interface DropdownSearchProps {
  onSelectionsChange?: (selections: DropdownSelection[]) => void;
}

export interface SelectionListProps {
  selections: DropdownSelection[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (selectionId: string) => void;
  onClear: () => void;
  onFocus?: (selectionId: string) => void;
  activeSelectionId?: string | null;
  pinnedSelectionId?: string | null;
}
