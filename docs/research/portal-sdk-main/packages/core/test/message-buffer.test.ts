import type { WireMessage } from "@portalsdk/wire-protocol";
import { describe, expect, it } from "vitest";

import { MessageBuffer } from "../src/message-buffer.js";

function wire(seq: number | null, over: Partial<WireMessage> = {}): WireMessage {
  return {
    id: `m_${seq}`,
    seq,
    type: "message",
    kind: "text",
    content: { text: `msg ${seq}` },
    sender: { id: "u_other", anon: false },
    timestamp: 1_000 + (seq ?? 0),
    retracted: false,
    ephemeral: false,
    ...over,
  };
}

function make(baseline = 0): MessageBuffer {
  const buffer = new MessageBuffer("room");
  buffer.setMe("u_me", false);
  buffer.setBaseline(baseline);
  return buffer;
}

describe("ordering and dedup", () => {
  it("renders persistent messages in seq order regardless of arrival order", () => {
    const buffer = make();
    buffer.ingest([wire(2)]);
    buffer.ingest([wire(1)]);
    expect(buffer.messages().map((m) => m.id)).toEqual(["m_1", "m_2"]);
  });

  it("drops a duplicate seq", () => {
    const buffer = make();
    buffer.ingest([wire(1)]);
    buffer.ingest([wire(1, { content: { text: "dupe" } })]);
    const messages = buffer.messages();
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toEqual({ text: "msg 1" });
  });

  it("strips seq and derives the public shape", () => {
    const buffer = make();
    buffer.ingest([wire(1, { mentions: [{ userId: "u_x" }] })]);
    const message = buffer.messages()[0];
    expect(message).toMatchObject({
      id: "m_1",
      channelId: "room",
      type: "message",
      kind: "text",
      status: "sent",
      unread: false,
      retracted: false,
      mentions: [{ userId: "u_x" }],
    });
    expect(message).not.toHaveProperty("seq");
  });
});

describe("contiguous high-water and gaps", () => {
  it("advances the high-water across contiguous arrivals", () => {
    const buffer = make(0);
    buffer.ingest([wire(1)]);
    buffer.ingest([wire(2)]);
    expect(buffer.contiguousSeq()).toBe(2);
  });

  it("reports the missing range and does not advance across a gap", () => {
    const buffer = make(0);
    const { gaps } = buffer.ingest([wire(3)]);
    expect(gaps).toEqual([[1, 2]]);
    expect(buffer.contiguousSeq()).toBe(0);
  });

  it("closes the gap and advances once the range is filled", () => {
    const buffer = make(0);
    buffer.ingest([wire(3)]);
    buffer.ingestHistory([wire(1), wire(2)]);
    expect(buffer.contiguousSeq()).toBe(3);
    expect(buffer.messages().map((m) => m.id)).toEqual(["m_1", "m_2", "m_3"]);
  });
});

describe("retraction", () => {
  it("applies a retract in place, tombstoning content", () => {
    const buffer = make();
    buffer.ingest([wire(1)]);
    buffer.retract(1);
    const message = buffer.messages()[0];
    expect(message?.retracted).toBe(true);
    expect(message?.content).toBeNull();
  });

  it("applies a retract that arrived before its message", () => {
    const buffer = make();
    buffer.retract(1);
    buffer.ingest([wire(1)]);
    const message = buffer.messages()[0];
    expect(message?.retracted).toBe(true);
    expect(buffer.contiguousSeq()).toBe(1);
  });
});

describe("optimistic sends", () => {
  it("appends a pending send, then reconciles to sent on ack", () => {
    const buffer = make();
    buffer.addOptimistic({
      tempId: "cl_1",
      type: "message",
      content: { text: "hi" },
      to: undefined,
      mentions: undefined,
      timestamp: 5_000,
    });
    let message = buffer.messages()[0];
    expect(message).toMatchObject({ id: "cl_1", status: "pending", sender: { id: "u_me" } });

    buffer.ack("cl_1", { id: "m_9", seq: 1, timestamp: 6_000 });
    message = buffer.messages()[0];
    expect(buffer.messages()).toHaveLength(1);
    expect(message).toMatchObject({ id: "m_9", status: "sent" });
    expect(buffer.contiguousSeq()).toBe(1);
  });

  it("rolls a rejected send back out of the window", () => {
    const buffer = make();
    buffer.addOptimistic({
      tempId: "cl_1",
      type: "message",
      content: { text: "hi" },
      to: undefined,
      mentions: undefined,
      timestamp: 5_000,
    });
    buffer.rollback("cl_1");
    expect(buffer.messages()).toHaveLength(0);
  });

  it("does not count the sender's own acked message as unread", () => {
    const buffer = make(0);
    buffer.setWatermark(0);
    buffer.addOptimistic({
      tempId: "cl_1",
      type: "message",
      content: { text: "hi" },
      to: undefined,
      mentions: undefined,
      timestamp: 5_000,
    });
    buffer.ack("cl_1", { id: "m_1", seq: 1, timestamp: 0 });

    // Posting advances my read position, so my own message is never unread to me.
    expect(buffer.channelUnread()).toBe(0);
    expect(buffer.messages().find((m) => m.id === "m_1")?.unread).toBe(false);
  });
});
