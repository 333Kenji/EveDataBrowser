import { useMemo, useState } from "react";

import { tokens } from "../styles/tokens";

const shipFilters = [
  { label: "Faction", options: ["Caldari", "Gallente", "Amarr", "Minmatar"] },
  { label: "Group", options: ["Frigate", "Destroyer", "Cruiser"] },
];

const blueprintFilters = [
  { label: "Activity", options: ["Manufacturing", "Invention"] },
  { label: "Category", options: ["Ships", "Modules", "Ammo"] },
];

type FiltersProps = {
  entity: "ships" | "blueprints";
};

export function Filters({ entity }: FiltersProps): JSX.Element {
  const sections = useMemo(() => (entity === "ships" ? shipFilters : blueprintFilters), [entity]);
  const [selected, setSelected] = useState<Record<string, string>>({});

  return (
    <aside aria-label="Filters" style={styles.container}>
      <h3 style={styles.title}>{entity === "ships" ? "Ship Filters" : "Blueprint Filters"}</h3>
      <div style={styles.grid}>
        {sections.map((section) => (
          <div key={section.label}>
            <label style={styles.label} htmlFor={`filter-${section.label}`}>
              {section.label}
            </label>
            <select
              id={`filter-${section.label}`}
              aria-label={section.label}
              style={styles.select}
              value={selected[section.label] ?? ""}
              onChange={(event) =>
                setSelected((prev) => ({ ...prev, [section.label]: event.target.value }))
              }
            >
              <option value="">All</option>
              {section.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </aside>
  );
}

const styles = {
  container: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    display: "flex",
    flexDirection: "column" as const,
    gap: tokens.spacing.md,
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
  },
  grid: {
    display: "grid",
    gap: tokens.spacing.sm,
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  },
  label: {
    display: "block",
    marginBottom: tokens.spacing.xs,
  },
  select: {
    width: "100%",
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.sm,
    border: "1px solid rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.3)",
    color: tokens.colors.textPrimary,
  },
};
