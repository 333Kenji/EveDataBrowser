import { useEffect, useMemo, useState } from "react";

import { tokens } from "../../styles/tokens";

const FEATURE_FLAG = import.meta.env.VITE_FEATURE_SHIP_3D === "true";

type ShipViewerProps = {
  featureEnabled?: boolean;
  loadViewer?: () => Promise<unknown>;
};

export function ShipViewer({ featureEnabled = FEATURE_FLAG, loadViewer }: ShipViewerProps): JSX.Element {
  const [viewerLoaded, setViewerLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (featureEnabled) {
      const loader = loadViewer ?? (() => import("three"));
      loader().then(() => {
        if (active) {
          setViewerLoaded(true);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [featureEnabled]);

  const content = useMemo(() => {
    if (!featureEnabled) {
      return (
        <div style={styles.fallback}>
          <p>3D viewer disabled. Showing faction poster.</p>
          <img
            style={styles.poster}
            src="/assets/placeholder-merlin.png"
            alt="Merlin ship poster"
          />
        </div>
      );
    }
    if (!viewerLoaded) {
      return <p>Loading 3D viewer…</p>;
    }
    return <p>Three.js viewer placeholder</p>;
  }, [featureEnabled, viewerLoaded]);

  return <section style={styles.container}>{content}</section>;
}

const styles = {
  container: {
    borderRadius: tokens.radii.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: tokens.spacing.md,
  },
  fallback: {
    display: "flex",
    flexDirection: "column" as const,
    gap: tokens.spacing.sm,
    alignItems: "center",
  },
  poster: {
    width: "100%",
    maxWidth: "320px",
    borderRadius: tokens.radii.md,
  },
};

export default ShipViewer;
