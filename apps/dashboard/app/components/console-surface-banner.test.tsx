import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConsoleSurfaceBanner } from "./console-surface-banner";

describe("ConsoleSurfaceBanner", () => {
  afterEach(cleanup);

  it("labels labs surfaces and links the catalog in a new tab", () => {
    render(<ConsoleSurfaceBanner pathname="/spatial" />);
    expect(screen.getByText("Labs surface.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /platform catalog/i });
    expect(link).toHaveAttribute("href", "/labs");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("labels preview surfaces", () => {
    render(<ConsoleSurfaceBanner pathname="/agents/platform" />);
    expect(screen.getByText("Preview surface.")).toBeInTheDocument();
  });

  it("stays silent on ga surfaces", () => {
    render(<ConsoleSurfaceBanner pathname="/rooms" />);
    expect(screen.queryByText("Labs surface.")).toBeNull();
    expect(screen.queryByText("Preview surface.")).toBeNull();
  });
});
