export const colors = {
  base: "#0a0b10",
  surface: "#111827",
  textPrimary: "#f8fafc",
  accentCyan: "#22d3ee",
  accentViolet: "#8b5cf6",
  accentGreen: "#22c55e",
};

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
};

export const typography = {
  fontFamily:
    '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  heading: {
    h1: "clamp(2rem, 2.8vw, 3rem)",
    h2: "clamp(1.5rem, 2vw, 2.25rem)",
    h3: "clamp(1.25rem, 1.6vw, 1.75rem)",
  },
  body: {
    size: "1rem",
    lineHeight: "1.6",
  },
};

export const radii = {
  sm: "0.375rem",
  md: "0.75rem",
  lg: "1rem",
};

export type DesignTokens = {
  colors: typeof colors;
  spacing: typeof spacing;
  typography: typeof typography;
  radii: typeof radii;
};

export const tokens: DesignTokens = {
  colors,
  spacing,
  typography,
  radii,
};
