import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import { Sidebar } from "../../src/components/Sidebar";

describe("Sidebar", () => {
  test("renders ship and blueprint links", () => {
    render(
      <MemoryRouter initialEntries={["/?entity=ships"]}>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /ships/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /blueprints/i })).toBeInTheDocument();
  });
});
