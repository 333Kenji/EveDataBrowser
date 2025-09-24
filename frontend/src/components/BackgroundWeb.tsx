import { CSSProperties, useEffect, useMemo, useState } from "react";

import { tokens } from "../styles/tokens";

const KEYFRAMES_ID = "background-web-keyframes";

function injectKeyframes(): void {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(KEYFRAMES_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes gradientShift {
      0% {
        transform: translate3d(0, 0, 0);
      }
      50% {
        transform: translate3d(-3%, -3%, 0) scale(1.05);
      }
      100% {
        transform: translate3d(0, 0, 0);
      }
    }
  `;
  document.head.appendChild(style);
}

function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BackgroundWeb(): JSX.Element {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [animationEnabled, setAnimationEnabled] = useState(!prefersReducedMotion);

  useEffect(() => {
    injectKeyframes();
  }, []);

  useEffect(() => {
    setAnimationEnabled(!prefersReducedMotion);
  }, [prefersReducedMotion]);

  const style = useMemo<CSSProperties>(() => {
    const base: CSSProperties = {
      position: "absolute",
      inset: 0,
      background: `radial-gradient(circle at 20% 20%, ${tokens.colors.accentCyan}33, transparent 60%),
        radial-gradient(circle at 80% 30%, ${tokens.colors.accentViolet}33, transparent 55%),
        radial-gradient(circle at 50% 80%, ${tokens.colors.accentGreen}33, transparent 60%)`,
      filter: "blur(40px)",
      opacity: 0.6,
      transform: "translate3d(0,0,0)",
    };
    if (animationEnabled) {
      base.animation = "gradientShift 25s ease-in-out infinite";
    }
    return base;
  }, [animationEnabled]);

  return <div aria-hidden="true" style={style} />;
}

export default BackgroundWeb;
