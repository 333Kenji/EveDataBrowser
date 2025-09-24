import { useMemo, useState } from "react";

import { tokens } from "../../styles/tokens";

const activityTabs = ["Manufacturing", "Invention"] as const;

export function BlueprintCard(): JSX.Element {
  const [activeTab, setActiveTab] = useState<(typeof activityTabs)[number]>("Manufacturing");

  const activity = useMemo(() => {
    if (activeTab === "Manufacturing") {
      return {
        materials: [
          { name: "Tritanium", quantity: "100" },
          { name: "Pyerite", quantity: "20" },
        ],
        products: [{ name: "Merlin", quantity: "1" }],
        time: "20 minutes",
        skills: [{ name: "Industry", level: 3 }],
      };
    }
    return {
      materials: [{ name: "Datacore - Rocket Science", quantity: "2" }],
      products: [{ name: "Merlin Blueprint Copy", quantity: "1" }],
      time: "12 hours",
      skills: [{ name: "Invention", level: 4 }],
    };
  }, [activeTab]);

  return (
    <article style={styles.card}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>Merlin Blueprint</h2>
          <p style={styles.subtitle}>Product: Merlin • Manifest sde-test-blueprint</p>
        </div>
      <span style={styles.badge}>Manifest sde-test-blueprint</span>
      </header>
      <nav aria-label="Blueprint activities" style={styles.tabList}>
        {activityTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              backgroundColor:
                tab === activeTab ? tokens.colors.accentGreen : "rgba(255,255,255,0.05)",
              color: tab === activeTab ? tokens.colors.base : tokens.colors.textPrimary,
            }}
          >
            {tab}
          </button>
        ))}
      </nav>
      <section style={styles.grid}>
        <div>
          <h3 style={styles.sectionTitle}>Materials</h3>
          <ul style={styles.list}>
            {activity.materials.map((item) => (
              <li key={item.name} style={styles.listItem}>
                <span>{item.name}</span>
                <span>{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style={styles.sectionTitle}>Products</h3>
          <ul style={styles.list}>
            {activity.products.map((item) => (
              <li key={item.name} style={styles.listItem}>
                <span>{item.name}</span>
                <span>{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style={styles.sectionTitle}>Skills</h3>
          <ul style={styles.list}>
            {activity.skills.map((item) => (
              <li key={item.name} style={styles.listItem}>
                <span>{item.name}</span>
                <span>Level {item.level}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <footer style={styles.footer}>Estimated Time: {activity.time}</footer>
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
    gap: tokens.spacing.md,
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
    backgroundColor: tokens.colors.accentGreen,
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
  grid: {
    display: "grid",
    gap: tokens.spacing.md,
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  },
  sectionTitle: {
    margin: 0,
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gap: tokens.spacing.xs,
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.xs,
  },
  footer: {
    marginTop: tokens.spacing.sm,
    color: "rgba(255,255,255,0.7)",
  },
};

export default BlueprintCard;
