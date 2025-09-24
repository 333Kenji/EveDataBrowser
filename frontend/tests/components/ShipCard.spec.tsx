import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ShipCard } from "../../src/components/cards/ShipCard";

describe("ShipCard", () => {
  test("renders manifest badge and tabs", () => {
    render(<ShipCard />);

    expect(screen.getAllByText(/sde-test-ships/i)).toHaveLength(2);
    expect(screen.getByRole("button", { name: /stats/i })).toBeInTheDocument();
  });

  test("switches tabs to show slot data", () => {
    render(<ShipCard />);
    const slotsTab = screen.getByRole("button", { name: /slots/i });
    fireEvent.click(slotsTab);
    expect(screen.getByText(/high/i)).toBeInTheDocument();
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });
});
