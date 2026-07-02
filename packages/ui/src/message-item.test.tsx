import * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageItem } from "./message-item";
import type { FluxyChatMessage } from "@fluxy-chat/sdk";

function makeMessage(overrides: Partial<FluxyChatMessage> = {}): FluxyChatMessage {
  return {
    id: 1,
    roomId: "room-1",
    userId: "user-1",
    content: "Hello",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("MessageItem bubble variant mapping", () => {
  it("maps local user to sent variant and end alignment", () => {
    const { container } = render(
      <MessageItem message={makeMessage()} localUserId="user-1" />
    );

    const bubble = container.querySelector('[data-slot="bubble"]');
    expect(bubble).toHaveAttribute("data-variant", "sent");
    expect(bubble).toHaveAttribute("data-align", "end");
  });

  it("maps agent sender to secondary variant and start alignment", () => {
    const message = makeMessage({ userId: "user-1", senderId: "agent-1" });
    const { container } = render(
      <MessageItem message={message} localUserId="user-2" />
    );

    const bubble = container.querySelector('[data-slot="bubble"]');
    expect(bubble).toHaveAttribute("data-variant", "secondary");
    expect(bubble).toHaveAttribute("data-align", "start");
  });

  it("maps another user to received variant and start alignment", () => {
    const { container } = render(
      <MessageItem message={makeMessage({ userId: "user-2" })} localUserId="user-1" />
    );

    const bubble = container.querySelector('[data-slot="bubble"]');
    expect(bubble).toHaveAttribute("data-variant", "received");
    expect(bubble).toHaveAttribute("data-align", "start");
  });

  it("uses explicit agent variant prop to drive secondary styling", () => {
    const { container } = render(
      <MessageItem
        message={makeMessage({ userId: "user-2" })}
        localUserId="user-1"
        variant="agent"
      />
    );

    const bubble = container.querySelector('[data-slot="bubble"]');
    expect(bubble).toHaveAttribute("data-variant", "secondary");
  });
});
