import { describe, expect, it } from "vitest";
import {
  FLUXY_INBOUND_EVENT_TYPES,
  FLUXY_OUTBOUND_EVENT_TYPES,
  isKnownOutboundClientEvent,
  parseInboundWsFrame,
} from "./index.js";

const INBOUND_SAMPLES: Array<{ label: string; frame: Record<string, unknown> }> = [
  { label: "pong", frame: { type: "pong" } },
  {
    label: "replay",
    frame: { type: "replay", messages: [{ id: 1, content: "hi" }] },
  },
  {
    label: "message",
    frame: {
      type: "message",
      id: 1,
      roomId: "lobby",
      userId: "alice",
      content: "hello",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  },
  {
    label: "edit",
    frame: {
      type: "edit",
      id: 1,
      roomId: "lobby",
      userId: "bot-1",
      content: "partial reply",
      editedAt: "2026-01-01T00:00:01.000Z",
      streaming: true,
    },
  },
  { label: "typing", frame: { type: "typing", userId: "alice", isTyping: true } },
  {
    label: "subscription_succeeded",
    frame: { type: "subscription_succeeded", subscriptionCount: 1, socketId: "s1" },
  },
  {
    label: "capability_event",
    frame: {
      type: "capability_event",
      roomId: "lobby",
      event: { eventId: "evt_1", type: "edu.poll.created", roomId: "lobby" },
    },
  },
  { label: "stream", frame: { type: "stream", op: "delta", runId: "r1", content: "Hi" } },
  { label: "error", frame: { type: "error", code: "forbidden", message: "nope" } },
];

const OUTBOUND_SAMPLES: Array<{ label: string; frame: Record<string, unknown> }> = [
  { label: "ping", frame: { type: "ping" } },
  { label: "message", frame: { type: "message", content: "hello" } },
  { label: "stream", frame: { type: "stream", op: "start", runId: "r1" } },
  { label: "edit", frame: { type: "edit", messageId: 1, content: "updated" } },
  { label: "reaction", frame: { type: "reaction", messageId: 1, emoji: "👍" } },
  { label: "read", frame: { type: "read", messageId: 99 } },
  { label: "client_event", frame: { type: "client_event", event: "cursor-move", data: { x: 1 } } },
];

describe("conformance (synthetic frames)", () => {
  it.each(INBOUND_SAMPLES)("$label parses without throwing", ({ frame }) => {
    const parsed = parseInboundWsFrame(JSON.stringify(frame));
    expect(parsed).not.toBeNull();
    if (parsed?.kind === "event") {
      expect(FLUXY_INBOUND_EVENT_TYPES as readonly string[]).toContain(
        String(parsed.event?.type),
      );
    }
  });

  it.each(OUTBOUND_SAMPLES)("$label is a known outbound client event", ({ frame }) => {
    expect(isKnownOutboundClientEvent(frame)).toBe(true);
    expect(FLUXY_OUTBOUND_EVENT_TYPES as readonly string[]).toContain(String(frame.type));
  });

  it("classifies transport vs event inbound frames", () => {
    expect(parseInboundWsFrame(JSON.stringify({ type: "pong" }))?.kind).toBe("pong");
    expect(parseInboundWsFrame(JSON.stringify({ type: "replay", messages: [] }))?.kind).toBe(
      "replay",
    );
    expect(parseInboundWsFrame(JSON.stringify({ type: "message", id: 1 }))?.kind).toBe("event");
  });

  it("rejects malformed frames and passthrough unknown types", () => {
    expect(parseInboundWsFrame("{")).toBeNull();
    const unknown = parseInboundWsFrame(JSON.stringify({ type: "not_a_real_event" }));
    expect(unknown?.kind).toBe("unknown");
    expect(unknown?.frame?.type).toBe("not_a_real_event");
  });
});
