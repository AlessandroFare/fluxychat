import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/worker-fetch", () => ({ fetchWorkerJson: vi.fn() }));
vi.mock("@/lib/worker-url-client", () => ({ getPublicWorkerUrl: () => "https://worker.test" }));

import { fetchWorkerJson } from "@/lib/worker-fetch";
import { Soc2ReportsPanel } from "./soc2-reports-panel";

const fetchMock = vi.mocked(
  fetchWorkerJson as unknown as (...args: unknown[]) => Promise<unknown>
);

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: "srpt_1",
    reportType: "audit",
    title: "Operations evidence pack",
    content: "# Pack",
    status: "draft",
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-10-01T00:00:00.000Z",
    createdAt: "2026-10-17T09:00:00.000Z",
    ...overrides,
  };
}

describe("Soc2ReportsPanel", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists saved reports and reveals content on demand", async () => {
    fetchMock.mockResolvedValue([report()]);
    render(<Soc2ReportsPanel token="jwt" />);

    expect(await screen.findByText("Operations evidence pack")).toBeTruthy();
    expect(screen.getByText("audit")).toBeTruthy();
    expect(screen.getByText("draft")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    expect(await screen.findByText("# Pack")).toBeTruthy();
  });

  it("marks a draft report final", async () => {
    fetchMock.mockResolvedValueOnce([report()]).mockResolvedValueOnce({ updated: true });
    render(<Soc2ReportsPanel token="jwt" />);

    fireEvent.click(await screen.findByRole("button", { name: /mark final/i }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /mark final/i })).toBeNull()
    );
    expect(screen.getByText("final")).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://worker.test/api/soc2/reports/srpt_1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("asks for the admin JWT when no token is set", () => {
    render(<Soc2ReportsPanel token="" />);
    expect(screen.getByText("Admin JWT required.")).toBeTruthy();
  });

  it("shows the empty state", async () => {
    render(<Soc2ReportsPanel token="jwt" />);
    expect(await screen.findByText("No report saved yet.")).toBeTruthy();
  });
});
