import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BlueprintMarketChart } from "../../src/components/cards/BlueprintMarketChart";

describe("BlueprintMarketChart", () => {
  test("renders provider badge", () => {
    render(<BlueprintMarketChart />);
    expect(screen.getByText(/provider: adam4eve/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/market series/i)).toBeInTheDocument();
  });

  test("changes window selection", () => {
    render(<BlueprintMarketChart />);
    const select = screen.getByLabelText(/window/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "30d" } });
    expect(select.value).toBe("30d");
  });
});
