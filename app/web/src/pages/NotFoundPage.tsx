import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <>
      <header>
        <h2>Route not found</h2>
        <p>The requested view is not part of the current shell preview.</p>
      </header>

      <section className="shell__section">
        <p>
          Return to the <Link to="/">overview</Link> to pick one of the planned vertical slices.
        </p>
      </section>
    </>
  );
}
