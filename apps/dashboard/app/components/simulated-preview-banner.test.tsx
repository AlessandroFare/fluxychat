import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SimulatedPreviewBanner } from "./simulated-preview-banner";

/** Console surfaces that fall back to local SDK demo state must carry the banner. */
const SIMULATION_SURFACES = [
  "components/console-surface-banner.tsx",
  "features/page.tsx",
  "components/vertical-studio.tsx",
];

describe("SimulatedPreviewBanner", () => {
  afterEach(cleanup);

  it("renders the uniform lead with the page-specific detail", () => {
    render(<SimulatedPreviewBanner>Detail here.</SimulatedPreviewBanner>);
    expect(screen.getByText("Preview — simulated data.")).toBeInTheDocument();
    expect(screen.getByText(/Detail here\./)).toBeInTheDocument();
  });

  it("labels static previews differently", () => {
    render(
      <SimulatedPreviewBanner label="Preview — static overview.">Static.</SimulatedPreviewBanner>,
    );
    expect(screen.getByText("Preview — static overview.")).toBeInTheDocument();
  });

  it("is wired into every simulation surface", () => {
    const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
    for (const rel of SIMULATION_SURFACES) {
      const source = readFileSync(join(appDir, rel), "utf8");
      expect(source, rel).toContain("SimulatedPreviewBanner");
    }
  });
});
