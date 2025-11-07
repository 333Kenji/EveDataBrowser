import { useState } from 'react';
import { DropdownSearch } from '../components/DropdownSearch';
import type { DropdownSelection } from '../state/dropdown-store';

export function DropdownSearchPage() {
  const [selections, setSelections] = useState<DropdownSelection[]>([]);

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Dropdown Search</h1>
        <p className="page__subtitle">
          Explore the cascaded taxonomy browser with latency-aware messaging, shortlist management, and keyboard
          shortcuts tuned for rapid fitting workflows.
        </p>
      </header>

      <section className="card" aria-labelledby="dropdown-goals">
        <h2 id="dropdown-goals">Experience Goals</h2>
        <ul className="card__list">
          <li>Keyboard-first filtering through categories, groups, and types.</li>
          <li>Selection caching so route changes preserve shortlisted items.</li>
          <li>Loading and error affordances that mirror API telemetry.</li>
        </ul>
      </section>

      <section className="card card--interactive">
        <DropdownSearch onSelectionsChange={setSelections} />
      </section>

      <section className="card" aria-live="polite">
        <h2>Detail Panel Primer</h2>
        <p>
          Cycle items with <kbd>Ctrl</kbd> + <kbd>Arrow</kbd>, pin a favourite hull, and confirm freshness via the
          embedded SDE badge. Selections below mirror the shortlist state.
        </p>
        {selections.length > 0 && (
          <ul className="card__list card__list--compact">
            {selections.map((selection) => (
              <li key={selection.id}>
                <strong>{selection.label}</strong> — category {selection.categoryId}, group {selection.groupId}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
