import { useMemo, useState } from "react";

import { tokens } from "../../styles/tokens";

const tabs = ["Stats", "Slots", "Attributes"] as const;

export function ShipCard(): JSX.Element {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Stats");
  const manifestVersion = "sde-test-ships";

  const content = useMemo(() => {
    switch (activeTab) {
      case "Stats":
        return [
          { label: "Mass", value: "1,200,000 kg" },
          { label: "Max Velocity", value: "325 m/s" },
        ];
      case "Slots":
        return [
          { label: "High", value: "4" },
          { label: "Medium", value: "4" },
          { label: "Low", value: "2" },
        ];
      case "Attributes":
        return [
          { label: "Signature Radius", value: "40 m" },
          { label: "Sensor Strength", value: "12 gravimetric" },
        ];
      default:
        return [];
    }
  }, [activeTab]);

  return (
    <article style={styles.card}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>Merlin</h2>
          <p style={styles.subtitle}>Caldari Frigate • Manifest {manifestVersion}</p>
        </div>
        <span style={styles.badge}>Manifest {manifestVersion}</span>
      </header>
      <nav aria-label="Ship detail tabs" style={styles.tabList}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              backgroundColor:
                tab === activeTab ? tokens.colors.accentCyan : "rgba(255,255,255,0.05)",
              color: tab === activeTab ? tokens.colors.base : tokens.colors.textPrimary,
            }}
          >
            {tab}
          </button>
        ))}
      </nav>
      <div style={styles.content}>
        {content.map((item) => (
          <div key={item.label} style={styles.row}>
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

const styles = {
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    display: "flex",
    flexDirection: "column" as const,
    gap: tokens.spacing.md,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "1.75rem",
  },
  subtitle: {
    margin: 0,
    color: "rgba(255,255,255,0.7)",
  },
  badge: {
    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.accentViolet,
    color: tokens.colors.base,
    fontWeight: 600,
  },
  tabList: {
    display: "flex",
    gap: tokens.spacing.sm,
  },
  tab: {
    border: "none",
    borderRadius: tokens.radii.sm,
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    cursor: "pointer",
  },
  content: {
    display: "grid",
    gap: tokens.spacing.sm,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.sm,
  },
};

export default ShipCard;
