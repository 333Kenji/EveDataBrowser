import { useEffect, useState, useMemo, useCallback, useId, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import styles from './MarketSearchAutocomplete.module.css';
import { fetchTaxonomySuggestions, type TaxonomyType } from '../../../services/taxonomy-service';
import { useSelectTaxonomyType } from '../useSelectTaxonomyType';

export function MarketSearchAutocomplete() {
  const [inputValue, setInputValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const selectTaxonomyType = useSelectTaxonomyType();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebounced(inputValue.trim());
    }, 150);

    return () => window.clearTimeout(handle);
  }, [inputValue]);

  const suggestionsQuery = useQuery({
    queryKey: ['taxonomy', 'suggestions', debounced],
    queryFn: () => fetchTaxonomySuggestions(debounced, 12),
    enabled: debounced.length > 0,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  const suggestions = suggestionsQuery.data ?? [];
  const hasSuggestions = suggestions.length > 0;
  const isOpen = isFocused && (hasSuggestions || suggestionsQuery.isFetching);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
    } else if (hasSuggestions) {
      setHighlightedIndex(0);
    }
  }, [isOpen, hasSuggestions]);

  const handleSelect = useCallback(
    (type: TaxonomyType) => {
      selectTaxonomyType(type);
      setInputValue(type.name);
      setIsFocused(false);
    },
    [selectTaxonomyType],
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!hasSuggestions) {
          return;
        }
        setIsFocused(true);
        setHighlightedIndex((current) => {
          if (event.key === 'ArrowDown') {
            const next = current + 1;
            return next >= suggestions.length ? 0 : next;
          }
          if (event.key === 'ArrowUp') {
            const next = current - 1;
            return next < 0 ? suggestions.length - 1 : next;
          }
          return current;
        });
        return;
      }

      if (event.key === 'Enter') {
        if (isOpen && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          event.preventDefault();
          handleSelect(suggestions[highlightedIndex]);
        }
        return;
      }

      if (event.key === 'Escape') {
        if (isOpen) {
          event.preventDefault();
          setIsFocused(false);
        }
      }
    },
    [handleSelect, hasSuggestions, highlightedIndex, isOpen, suggestions],
  );

  const closeSuggestions = useCallback(() => {
    closeTimerRef.current = window.setTimeout(() => {
      setIsFocused(false);
    }, 120);
  }, []);

  const cancelCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const renderStatus = useMemo(() => {
    if (suggestionsQuery.isFetching) {
      return <div className={styles.loading}>Searching...</div>;
    }

    if (debounced.length > 0 && !hasSuggestions) {
      return <div className={styles.empty}>No matches found.</div>;
    }

    return null;
  }, [debounced.length, hasSuggestions, suggestionsQuery.isFetching]);

  return (
    <div className={styles.autocomplete}>
      <input
        ref={inputRef}
        id="market-nav-search"
        type="text"
        className={`sidebar__search sidebar__search--dark ${styles.input}`}
        placeholder="Search database..."
        aria-label="Market navigation search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={handleInputKeyDown}
        onFocus={() => {
          cancelCloseTimer();
          setIsFocused(true);
        }}
        onBlur={closeSuggestions}
        autoComplete="off"
      />
      {isOpen && (
        <ul id={listboxId} role="listbox" className={styles.listbox}>
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listboxId}-option-${index}`}
              role="option"
              data-highlighted={highlightedIndex === index}
              aria-selected={highlightedIndex === index}
              className={styles.option}
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(suggestion);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span>{suggestion.name}</span>
              <span className={styles.meta}>
                {suggestion.categoryName}
                {suggestion.groupName ? ` • ${suggestion.groupName}` : ''}
              </span>
            </li>
          ))}
          {!hasSuggestions && renderStatus}
        </ul>
      )}
      {!isOpen && renderStatus}
    </div>
  );
}
