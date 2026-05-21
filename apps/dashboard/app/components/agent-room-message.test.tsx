import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentRoomMessage } from "./agent-room-message";

describe("AgentRoomMessage", () => {
  it("shows streaming badge and pulse cursor while streaming", () => {
    render(
      <AgentRoomMessage
        message={{
          id: 42,
          roomId: "assistant:general",
          userId: "builtin-assistant-p1",
          content: "Hello wor",
          createdAt: "2026-05-01T00:00:00.000Z",
          streaming: true,
        }}
        agentId="builtin-assistant-p1"
      />,
    );
    expect(screen.getByTestId("agent-message-streaming")).toBeInTheDocument();
    expect(screen.getByText("streaming")).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();
  });
});
