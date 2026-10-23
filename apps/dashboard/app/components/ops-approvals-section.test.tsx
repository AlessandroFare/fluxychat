import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ops-client", () => ({
  opsListApprovals: vi.fn(),
  opsDecideApproval: vi.fn(),
}));

import { opsDecideApproval, opsListApprovals } from "@/lib/ops-client";
import { OpsApprovalsSection } from "./ops-approvals-section";

const listMock = vi.mocked(opsListApprovals);
const decideMock = vi.mocked(opsDecideApproval);

function approval(overrides: Record<string, unknown> = {}) {
  return {
    id: "oap_1",
    runId: "run_1234567890",
    stepId: "approve-write",
    payloadHash: "hash-abcdef123456",
    required: 1,
    decisions: [],
    payload: { tool: "notify.send", input: { channel: "#ops" } },
    ...overrides,
  };
}

describe("OpsApprovalsSection", () => {
  beforeEach(() => {
    listMock.mockResolvedValue({ items: [] });
    decideMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists pending run approvals and keeps publisher approvals out", async () => {
    listMock.mockResolvedValue({
      items: [
        approval(),
        approval({ id: "oap_pub", stepId: "publish", payload: { versionId: "v1" } }),
      ],
    });
    render(<OpsApprovalsSection token="jwt" />);

    expect(await screen.findByText("notify.send")).toBeTruthy();
    expect(screen.getByText(/0 of 1 approvals/)).toBeTruthy();
    expect(screen.queryByText("publish")).toBeNull();
    expect(screen.getByRole("button", { name: /approve/i })).toBeTruthy();
  });

  it("decides with the frozen payload hash and reloads the list", async () => {
    listMock.mockResolvedValueOnce({ items: [approval()] }).mockResolvedValueOnce({ items: [] });
    render(<OpsApprovalsSection token="jwt" />);

    fireEvent.click(await screen.findByRole("button", { name: /deny/i }));

    await waitFor(() => expect(decideMock).toHaveBeenCalledTimes(1));
    expect(decideMock).toHaveBeenCalledWith("jwt", "oap_1", "deny", "hash-abcdef123456");
    expect(await screen.findByText("Nothing to approve")).toBeTruthy();
  });

  it("shows the empty state when nothing waits", async () => {
    render(<OpsApprovalsSection token="jwt" />);
    expect(await screen.findByText("Nothing to approve")).toBeTruthy();
  });

  it("surfaces a decision failure and reloads the stale row", async () => {
    listMock.mockResolvedValue({ items: [approval()] });
    decideMock.mockRejectedValue(new Error("forbidden"));
    render(<OpsApprovalsSection token="jwt" />);

    fireEvent.click(await screen.findByRole("button", { name: /approve/i }));
    expect(await screen.findByText("forbidden")).toBeTruthy();
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    // The reload must not wipe the reason the decision failed.
    expect(screen.getByText("forbidden")).toBeTruthy();
  });

  it("asks for a token when signed out", () => {
    render(<OpsApprovalsSection token="" />);
    expect(screen.getByText("Sign in with a project token to see approvals.")).toBeTruthy();
  });
});
