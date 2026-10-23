import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageHistoryDialog, type MessageHistoryClient } from "./message-history-dialog";

afterEach(cleanup);

function clientWith(): MessageHistoryClient {
  return {
    getMessageVersionsRest: vi.fn().mockResolvedValue([
      { id: 7, content: "first draft", createdAt: "2026-01-01T10:00:00.000Z", userId: "alice" },
      { id: 7, content: "final text", createdAt: "2026-01-01T10:05:00.000Z", userId: "alice" },
    ]),
  };
}

describe("MessageHistoryDialog", () => {
  it("loads versions and marks the last one as current", async () => {
    const client = clientWith();
    render(
      <MessageHistoryDialog
        open
        client={client}
        roomId="room-1"
        messageId={7}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("message-history-list")).toBeInTheDocument();
    });
    expect(client.getMessageVersionsRest).toHaveBeenCalledWith("room-1", 7);
    expect(screen.getByText("first draft")).toBeInTheDocument();
    expect(screen.getByText("final text")).toBeInTheDocument();
    expect(screen.getByText(/v2 · current/)).toBeInTheDocument();
  });

  it("does not fetch while closed", () => {
    const client = clientWith();
    render(
      <MessageHistoryDialog
        open={false}
        client={client}
        roomId="room-1"
        messageId={7}
        onClose={() => {}}
      />,
    );
    expect(client.getMessageVersionsRest).not.toHaveBeenCalled();
  });
});
