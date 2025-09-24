import { useMemo, useState } from "react";

import { tokens } from "../../styles/tokens";

type MarketPoint = {
  ts: string;
  price: number;
  volume: number;
};

const MOCK_SERIES: Record<string, MarketPoint[]> = {
  "7d": [
    { ts: "2025-09-18", price: 48, volume: 850 },
    { ts: "2025-09-19", price: 49, volume: 900 },
    { ts: "2025-09-20", price: 50, volume: 1100 },
    { ts: "2025-09-21", price: 52, volume: 1050 },
  ],
  "30d": [
    { ts: "2025-08-24", price: 45, volume: 700 },
    { ts: "2025-09-05", price: 47, volume: 800 },
    { ts: "2025-09-15", price: 49, volume: 950 },
    { ts: "2025-09-20", price: 51, volume: 1100 },
  ],
};

const PROVIDERS = ["adam4eve", "fuzzwork"] as const;

export function BlueprintMarketChart(): JSX.Element {
  const [window, setWindow] = useState<"7d" | "30d">("7d");
  const [provider, setProvider] = useState<typeof PROVIDERS[number]>("adam4eve");

  const series = useMemo(() => MOCK_SERIES[window], [window]);

  return (
    <section style={styles.card}>
      <header style={styles.header}>
        <h3 style={styles.title}>Market Overview</h3>
        <div style={styles.controls}>
          <label>
            Window
            <select
              style={styles.select}
              value={window}
              onChange={(event) => setWindow(event.target.value as "7d" | "30d")}
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </label>
          <label>
            Provider
            <select
              style={styles.select}
              value={provider}
              onChange={(event) => setProvider(event.target.value as typeof PROVIDERS[number])}
            >
              {PROVIDERS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <div style={styles.badge}>Provider: {provider}</div>
      <ul style={styles.list} aria-label="Market series">
        {series.map((point) => (
          <li key={point.ts} style={styles.listItem}>
            <span>{point.ts}</span>
            <span>Price: {point.price}</span>
            <span>Volume: {point.volume}</span>
          </li>
        ))}
      </ul>
    </section>
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
  },
  controls: {
    display: "flex",
    gap: tokens.spacing.sm,
  },
  select: {
    marginLeft: tokens.spacing.xs,
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.xs,
    backgroundColor: "rgba(0,0,0,0.3)",
    color: tokens.colors.textPrimary,
  },
  badge: {
    alignSelf: "flex-start",
    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
    backgroundColor: tokens.colors.accentCyan,
    borderRadius: tokens.radii.sm,
    color: tokens.colors.base,
    fontWeight: 600,
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
};

export default BlueprintMarketChart;
