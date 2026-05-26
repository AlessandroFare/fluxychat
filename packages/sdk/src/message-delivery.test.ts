import { describe, expect, it } from "vitest";
import {
  applyServerMessageAck,
  createOptimisticMessage,
  markMessageDeliveryFailed,
  tryMatchPendingByInbound,
} from "./message-delivery";

describe("message-delivery", () => {
  it("creates pending optimistic message", () => {
    const msg = createOptimisticMessage({
      roomId: "r1",
      userId: "alice",
      content: "hi",
      clientMessageId: "cmsg_1",
    });
    expect(msg.deliveryStatus).toBe("pending");
    expect(msg.id).toBeLessThan(0);
  });

  it("replaces pending with server ack", () => {
    const pending = createOptimisticMessage({
      roomId: "r1",
      userId: "alice",
      content: "hi",
      clientMessageId: "cmsg_1",
    });
    const merged = applyServerMessageAck(
      [pending],
      {
        id: 42,
        roomId: "r1",
        userId: "alice",
        content: "hi",
        createdAt: pending.createdAt,
      },
      "cmsg_1",
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe(42);
    expect(merged[0]?.deliveryStatus).toBe("sent");
  });

  it("marks failed delivery", () => {
    const pending = createOptimisticMessage({
      roomId: "r1",
      userId: "alice",
      content: "hi",
      clientMessageId: "cmsg_1",
    });
    const failed = markMessageDeliveryFailed([pending], "cmsg_1", "network");
    expect(failed[0]?.deliveryStatus).toBe("failed");
    expect(failed[0]?.deliveryError).toBe("network");
  });

  it("matches inbound WS message to pending", () => {
    const pending = createOptimisticMessage({
      roomId: "r1",
      userId: "alice",
      content: "hi",
      clientMessageId: "cmsg_1",
    });
    const merged = tryMatchPendingByInbound(
      [pending],
      {
        id: 99,
        roomId: "r1",
        userId: "alice",
        content: "hi",
        createdAt: new Date().toISOString(),
      },
      "alice",
    );
    expect(merged[0]?.id).toBe(99);
    expect(merged[0]?.clientMessageId).toBe("cmsg_1");
  });
});
