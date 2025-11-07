export function IngestionPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Ingestion Foundation</h1>
        <p className="page__subtitle">
          Feature 004 reinstates the lightweight Eve SDE importer so dropdown and taxonomy slices can rely on
          live data without manual refreshes.
        </p>
      </header>

      <section className="card">
        <h2>Scope Preview</h2>
        <p>
          The pipeline hydrates <code>invCategories</code>, <code>invGroups</code>, and <code>invTypes</code>
          with checksum enforcement, manifest logging, and rollback-friendly reports that surface in the
          Quickstart guide.
        </p>
      </section>

      <section className="card" aria-labelledby="ingestion-readiness">
        <h2 id="ingestion-readiness">Readiness Cues</h2>
        <ul className="card__list">
          <li>Database migrations align with the Lite schema and indexes in the taxonomy plan.</li>
          <li>Background watcher reports progress through the status indicator stream.</li>
          <li>Quickstart documents prepare, run, and reset commands for automated verification.</li>
        </ul>
      </section>
    </div>
  );
}
