import { describe, expect, test } from "vitest";

import { tokens } from "../../src/styles/tokens";

describe("design tokens", () => {
  test("include expected accents", () => {
    expect(tokens.colors.accentCyan).toBe("#22d3ee");
    expect(tokens.colors.accentViolet).toBe("#8b5cf6");
    expect(tokens.colors.accentGreen).toBe("#22c55e");
  });

  test("exports spacing scale", () => {
    expect(tokens.spacing).toMatchObject({
      xs: "0.25rem",
      sm: "0.5rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2rem",
    });
  });
});
