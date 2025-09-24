import { useMemo } from "react";

import { tokens } from "../styles/tokens";

export function SearchShell(): JSX.Element {
  const placeholderItems = useMemo(
    () => ["Rifter", "Merlin", "Caracal"],
    []
  );

  return (
    <section style={styles.container} aria-label="Global search">
      <header style={styles.header}>
        <h2>Search</h2>
        <p style={styles.caption}>
          Find ships or blueprints. Live results wire up once the API is ready.
        </p>
        <input
          style={styles.input}
          type="search"
          aria-label="Search query"
          placeholder="Search ships or blueprints"
        />
      </header>
      <div style={styles.list}>
        {placeholderItems.map((item) => (
          <div key={item} style={styles.listItem}>
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    display: "flex",
    flexDirection: "column" as const,
    gap: tokens.spacing.lg,
  },
  header: {
    display: "flex",
    flexDirection: "column" as const,
    gap: tokens.spacing.sm,
  },
  caption: {
    margin: 0,
    color: tokens.colors.accentCyan,
  },
  input: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    border: "1px solid rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.3)",
    color: tokens.colors.textPrimary,
  },
  list: {
    display: "grid",
    gap: tokens.spacing.sm,
  },
  listItem: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
};

export default SearchShell;
