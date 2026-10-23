import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ops-client", () => ({ opsOversight: vi.fn() }));

import { opsOversight, type OpsOversight } from "@/lib/ops-client";
import { OpsOversightSection } from "./ops-oversight-section";

const oversightMock = vi.mocked(opsOversight);

function metrics(overrides: Partial<OpsOversight> = {}): OpsOversight {
  return {
    from: null,
    to: null,
    fastSeconds: 10,
    requested: 12,
    pending: 2,
    decided: 10,
    approved: 9,
    denied: 1,
    medianDecisionSeconds: 42,
    fastDecisions: 8,
    fastShare: 0.8,
    quorumRequested: 4,
    quorumMet: 3,
    quorumRate: 0.75,
    distinctApprovers: 3,
    toolDenials: 5,
    rubberStamp: true,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OpsOversightSection", () => {
  it("shows the metrics and flags fast approvals", async () => {
    oversightMock.mockResolvedValue(metrics());
    render(<OpsOversightSection token="t" />);

    expect(await screen.findByText(/most decisions land under 10s/i)).toBeInTheDocument();
    expect(screen.getByText("10 decided · 2 pending")).toBeInTheDocument();
    expect(screen.getByText("42s")).toBeInTheDocument();
    expect(screen.getByText("80% (8)")).toBeInTheDocument();
    expect(screen.getByText("3/4")).toBeInTheDocument();
    expect(screen.getByText("1/10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/3 approver\(s\) decided in the window/)).toBeInTheDocument();
  });

  it("stays quiet below the rubber-stamp sample size", async () => {
    oversightMock.mockResolvedValue(
      metrics({ decided: 2, pending: 0, approved: 2, denied: 0, fastShare: 1, fastDecisions: 2, rubberStamp: false }),
    );
    render(<OpsOversightSection token="t" />);

    expect(await screen.findByText("2 decided · 0 pending")).toBeInTheDocument();
    expect(screen.queryByText(/most decisions land/i)).not.toBeInTheDocument();
  });

  it("surfaces a load failure", async () => {
    oversightMock.mockRejectedValue(new Error("boom"));
    render(<OpsOversightSection token="t" />);

    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });

  it("asks for a token when signed out", () => {
    render(<OpsOversightSection token="" />);
    expect(oversightMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
