export function OverviewPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Project Pulse</h1>
        <p className="page__subtitle">
          Track which slices are live, what remains in flight, and how the current build aligns with the master
          plan milestones.
        </p>
      </header>

      <section className="card-grid" aria-labelledby="milestones">
        <h2 id="milestones" className="card-grid__title">
          Active Milestones
        </h2>
        <ul className="card-grid__list">
          <li className="card-grid__item">
            <strong>Feature 004</strong>
            <span>SDE ingest foundation powers taxonomy browsing.</span>
          </li>
          <li className="card-grid__item">
            <strong>Feature 005</strong>
            <span>Browse API delivers category → group → type hierarchies.</span>
          </li>
          <li className="card-grid__item">
            <strong>Feature 006</strong>
            <span>Dropdown search validates cascaded selection UX.</span>
          </li>
          <li className="card-grid__item">
            <strong>Feature 007</strong>
            <span>Item detail panel supplies lore and attribute previews.</span>
          </li>
        </ul>
      </section>

      <section className="card" aria-labelledby="review-checklist">
        <h2 id="review-checklist">Readiness Checklist</h2>
        <ul className="card__list">
          <li>Keyboard navigation flows across all routes without trap.</li>
          <li>Health telemetry reflects API and ingest status in real time.</li>
          <li>Filament backdrop remains performant on low-power hardware.</li>
        </ul>
      </section>
    </div>
  );
}
