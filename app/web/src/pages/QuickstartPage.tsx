export function QuickstartPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Quickstart Guide</h1>
        <p className="page__subtitle">
          Use these steps whenever the shell reports connectivity issues or you need to bootstrap the stack from
          scratch.
        </p>
      </header>

      <section className="card" aria-labelledby="quickstart-services">
        <h2 id="quickstart-services">Bring Services Online</h2>
        <ol className="card__list card__list--numbered">
          <li>
            Start the stack: <code>DB_PORT=55432 docker compose up -d db api web</code>.
          </li>
          <li>
            Install web dependencies: <code>docker compose exec web npm install</code>.
          </li>
          <li>
            Launch the client: <code>docker compose exec web npm run dev -- --host</code>.
          </li>
        </ol>
      </section>

      <section className="card" aria-labelledby="quickstart-tests">
        <h2 id="quickstart-tests">Smoke Tests</h2>
        <p>
          Run <code>docker compose exec web npm run test</code> to execute the functional suite, followed by
          <code>npm run bootstrap:validate</code> at the workspace root to confirm the ingest and taxonomy endpoints
          are healthy.
        </p>
      </section>
    </div>
  );
}
