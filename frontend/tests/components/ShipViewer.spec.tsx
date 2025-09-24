import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ShipViewer } from "../../src/components/cards/ShipViewer";

describe("ShipViewer", () => {
  test("renders fallback poster when feature disabled", () => {
    render(<ShipViewer featureEnabled={false} />);
    expect(screen.getByText(/viewer disabled/i)).toBeInTheDocument();
  });

  test("shows loading state when feature enabled", () => {
    const loadStub = () => Promise.resolve();
    render(<ShipViewer featureEnabled loadViewer={loadStub} />);
    expect(screen.getByText(/loading 3d viewer/i)).toBeInTheDocument();
  });
});
