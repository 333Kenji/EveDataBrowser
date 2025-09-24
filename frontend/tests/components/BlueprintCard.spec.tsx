import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BlueprintCard } from "../../src/components/cards/BlueprintCard";

describe("BlueprintCard", () => {
  test("renders manifest badge and manufacturing tab", () => {
    render(<BlueprintCard />);
    expect(screen.getAllByText(/sde-test-blueprint/i)).toHaveLength(2);
    expect(screen.getByRole("button", { name: /manufacturing/i })).toBeInTheDocument();
  });

  test("switches tab to show invention data", () => {
    render(<BlueprintCard />);
    fireEvent.click(screen.getByRole("button", { name: /invention/i }));
    expect(screen.getByText(/datacore/i)).toBeInTheDocument();
  });
});
