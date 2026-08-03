import { describe, expect, it } from "vitest";
import {
  applyServerMessageAck,
  createOptimisticMessage,
  markMessageDeliveryFailed,
  mergeHistoryWithPendingDelivery,
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

  it("matches inbound WS message to pending by clientMessageId", () => {
    const pending = createOptimisticMessage({
      roomId: "r1",
      userId: "alice",
      content: "hi",
      clientMessageId: "cmsg_abc12345_xyz",
    });
    const merged = tryMatchPendingByInbound(
      [pending],
      {
        id: 99,
        roomId: "r1",
        userId: "alice",
        content: "different-body",
        createdAt: new Date().toISOString(),
        clientMessageId: "cmsg_abc12345_xyz",
      },
      "alice",
    );
    expect(merged[0]?.id).toBe(99);
    expect(merged[0]?.clientMessageId).toBe("cmsg_abc12345_xyz");
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

  it("retry preserves clientMessageId for idempotent resend", () => {
    const pending = createOptimisticMessage({
      roomId: "r1",
      userId: "alice",
      content: "retry me",
      clientMessageId: "cmsg_retry_1",
    });
    const failed = markMessageDeliveryFailed([pending], "cmsg_retry_1", "network");
    expect(failed[0]?.clientMessageId).toBe("cmsg_retry_1");
    expect(failed[0]?.deliveryStatus).toBe("failed");
  });

  it("flags deliveryConflict when server ack content differs", () => {
    const pending = createOptimisticMessage({
      roomId: "r1",
      userId: "alice",
      content: "hello world",
      clientMessageId: "cmsg_conflict",
    });
    const merged = applyServerMessageAck(
      [pending],
      {
        id: 50,
        roomId: "r1",
        userId: "alice",
        content: "hello WORLD",
        createdAt: pending.createdAt,
      },
      "cmsg_conflict",
    );
    expect(merged[0]?.deliveryConflict).toBe(true);
  });

  it("mergeHistoryWithPendingDelivery keeps inflight pending not yet on server", () => {
    const pending = createOptimisticMessage({
      roomId: "r1",
      userId: "alice",
      content: "still sending",
      clientMessageId: "cmsg_inflight",
    });
    const merged = mergeHistoryWithPendingDelivery(
      [pending],
      [{
        id: 1,
        roomId: "r1",
        userId: "bob",
        content: "from server",
        createdAt: "2026-01-01T00:00:00Z",
      }],
    );
    expect(merged).toHaveLength(2);
    expect(merged.some((m) => m.clientMessageId === "cmsg_inflight")).toBe(true);
  });
});
