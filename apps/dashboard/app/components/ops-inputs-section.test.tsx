import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ops-client", () => ({
  opsInputRequests: vi.fn(),
  opsAnswerRunInput: vi.fn(),
}));

import { opsAnswerRunInput, opsInputRequests } from "@/lib/ops-client";
import { OpsInputsSection } from "./ops-inputs-section";

const listMock = vi.mocked(opsInputRequests);
const answerMock = vi.mocked(opsAnswerRunInput);

function pendingInput(overrides: Record<string, unknown> = {}) {
  return {
    runId: "run_1234567890",
    roomId: "room-1",
    stepId: "deploy",
    tool: "mcp.call",
    server: "iam",
    message: "Which environment?",
    requestId: "elicit-1",
    requestedSchema: {
      type: "object",
      properties: { env: { type: "string", title: "Environment" } },
      required: ["env"],
    },
    askedAt: "2026-10-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("OpsInputsSection", () => {
  beforeEach(() => {
    listMock.mockResolvedValue({ items: [] });
    answerMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists open questions with a field per requested property", async () => {
    listMock.mockResolvedValue({ items: [pendingInput()] });
    render(<OpsInputsSection token="jwt" />);

    expect(await screen.findByText("Which environment?")).toBeTruthy();
    expect(screen.getByText(/mcp.call on iam/)).toBeTruthy();
    expect(screen.getByText("Environment")).toBeTruthy();
  });

  it("requires the declared field, then answers with the request id and content", async () => {
    listMock.mockResolvedValueOnce({ items: [pendingInput()] }).mockResolvedValueOnce({ items: [] });
    render(<OpsInputsSection token="jwt" />);

    fireEvent.click(await screen.findByRole("button", { name: /answer/i }));
    expect(await screen.findByText(/Fill in "Environment"/)).toBeTruthy();
    expect(answerMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: "staging" } });
    fireEvent.click(screen.getByRole("button", { name: /answer/i }));

    await waitFor(() => expect(answerMock).toHaveBeenCalledTimes(1));
    expect(answerMock).toHaveBeenCalledWith("jwt", "run_1234567890", [
      { id: "elicit-1", content: { env: "staging" } },
    ]);
    expect(await screen.findByText("No open questions")).toBeTruthy();
  });

  it("falls back to a single free-form field without a requested schema", async () => {
    listMock.mockResolvedValue({ items: [pendingInput({ requestedSchema: null })] });
    render(<OpsInputsSection token="jwt" />);

    fireEvent.change(await screen.findByLabelText("answer"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: /answer/i }));

    await waitFor(() => expect(answerMock).toHaveBeenCalledTimes(1));
    expect(answerMock).toHaveBeenCalledWith("jwt", "run_1234567890", [{ id: "elicit-1", content: { answer: "yes" } }]);
  });

  it("surfaces an answer failure and reloads the stale row", async () => {
    listMock.mockResolvedValue({ items: [pendingInput()] });
    answerMock.mockRejectedValue(new Error("run_not_waiting"));
    render(<OpsInputsSection token="jwt" />);

    fireEvent.change(await screen.findByLabelText("Environment"), { target: { value: "prod" } });
    fireEvent.click(screen.getByRole("button", { name: /answer/i }));

    expect(await screen.findByText("run_not_waiting")).toBeTruthy();
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText("run_not_waiting")).toBeTruthy();
  });

  it("shows the empty state when nothing waits", async () => {
    render(<OpsInputsSection token="jwt" />);
    expect(await screen.findByText("No open questions")).toBeTruthy();
  });

  it("asks for a token when signed out", () => {
    render(<OpsInputsSection token="" />);
    expect(screen.getByText("Sign in with a project token to see open questions.")).toBeTruthy();
  });
});
