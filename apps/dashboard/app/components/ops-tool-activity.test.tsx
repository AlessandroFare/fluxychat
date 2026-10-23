import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ops-client", () => ({
  opsToolCalls: vi.fn(),
}));

import { opsToolCalls } from "@/lib/ops-client";
import { OpsToolActivity } from "./ops-tool-activity";

const listMock = vi.mocked(opsToolCalls);

function call(overrides: Record<string, unknown> = {}) {
  return {
    id: "oev_1",
    runId: "run_1234567890",
    actor: "u1",
    eventType: "ops.tool.called",
    inputHash: "hash-1",
    createdAt: "2026-10-17T10:00:00.000Z",
    result: { tool: "files.search" },
    ...overrides,
  };
}

describe("OpsToolActivity", () => {
  beforeEach(() => {
    listMock.mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders ran, waiting and denied calls with the deny reason", async () => {
    listMock.mockResolvedValue({
      items: [
        call({ id: "a", eventType: "ops.tool.denied", result: { tool: "mcp.call", error: "budget_exceeded" } }),
        call({ id: "b", eventType: "ops.tool.approval_required", result: { tool: "notify.send", payloadHash: "h" } }),
        call({ id: "d", eventType: "ops.tool.failed", result: { tool: "files.search", error: "ai_search_unavailable" } }),
        call({ id: "c", result: { tool: "incidents.read" } }),
      ],
    });
    render(<OpsToolActivity token="jwt" />);

    expect(await screen.findByText("denied")).toBeTruthy();
    expect(screen.getByText("budget_exceeded")).toBeTruthy();
    expect(screen.getByText("waiting approval")).toBeTruthy();
    expect(screen.getByText("failed")).toBeTruthy();
    expect(screen.getByText("ai_search_unavailable")).toBeTruthy();
    expect(screen.getByText("ran")).toBeTruthy();
    expect(screen.getAllByText("files.search").length).toBe(1);
  });

  it("shows the empty state when nothing ran", async () => {
    render(<OpsToolActivity token="jwt" />);
    expect(await screen.findByText("No tool calls yet")).toBeTruthy();
  });

  it("surfaces a load failure", async () => {
    listMock.mockRejectedValue(new Error("forbidden"));
    render(<OpsToolActivity token="jwt" />);
    expect(await screen.findByText("forbidden")).toBeTruthy();
  });
});
