import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Filters } from "../../src/components/Filters";

describe("Filters", () => {
  test("renders ship filters", () => {
    render(<Filters entity="ships" />);
    expect(screen.getByText(/ship filters/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Faction/i)).toBeInTheDocument();
  });

  test("allows selection change", () => {
    render(<Filters entity="blueprints" />);
    const select = screen.getByLabelText(/Activity/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "Invention" } });
    expect(select.value).toBe("Invention");
  });
});
