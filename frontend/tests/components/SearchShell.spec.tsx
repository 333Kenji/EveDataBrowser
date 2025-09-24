import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import { SearchShell } from "../../src/components/SearchShell";


describe("SearchShell", () => {
  test("renders placeholder list", () => {
    render(
      <MemoryRouter>
        <SearchShell />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /search/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search ships or blueprints/i)).toBeInTheDocument();
  });
});
