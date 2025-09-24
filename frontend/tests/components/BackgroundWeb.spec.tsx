import { cleanup, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { BackgroundWeb } from "../../src/components/BackgroundWeb";

const originalMatchMedia = window.matchMedia;

describe("BackgroundWeb", () => {
  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  test("animates when reduced motion not requested", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false } as MediaQueryList);
    const { container } = render(<BackgroundWeb />);
    const div = container.querySelector("div");
    expect(div?.style.animation).toContain("gradientShift");
  });

  test("disables animation when reduced motion is preferred", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true } as MediaQueryList);
    const { container } = render(<BackgroundWeb />);
    const div = container.querySelector("div");
    expect(div?.style.animation).toBe("");
  });
});
