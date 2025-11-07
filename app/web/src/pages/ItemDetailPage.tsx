export function ItemDetailPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Item Detail Preview</h1>
        <p className="page__subtitle">
          Feature 007 restores the attribute panel and lore snippets used to validate data fidelity once a type is
          shortlisted in the dropdown search.
        </p>
      </header>

      <section className="card" aria-labelledby="detail-data-slices">
        <h2 id="detail-data-slices">Planned Data Slices</h2>
        <ul className="card__list">
          <li>Core stats: mass, slot layout, fitting requirements, and meta level.</li>
          <li>Lore excerpts and sourcing tips co-located with attributes.</li>
          <li>Market hooks that will link to features 012 and 013 when revived.</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="detail-validation">
        <h2 id="detail-validation">Validation Criteria</h2>
        <p>
          Functional tests cover focus management, keyboard cycling, and responsive stacks. The current scaffold
          keeps the panel lightweight while we refactor the blueprint browser.
        </p>
      </section>
    </div>
  );
}
