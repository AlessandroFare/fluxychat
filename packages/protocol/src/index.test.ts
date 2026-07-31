import { describe, expect, it } from "vitest";
import {
  FLUXY_INBOUND_EVENT_TYPES,
  FLUXY_OUTBOUND_EVENT_TYPES,
  FLUXY_PROTOCOL_VERSION,
  assertInboundEventType,
  isFluxyInboundEvent,
  isFluxyOutboundEvent,
} from "./index.js";

describe("@fluxy-chat/protocol", () => {
  it("exposes a stable protocol version", () => {
    expect(FLUXY_PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("recognizes core inbound events", () => {
    expect(isFluxyInboundEvent({ type: "message", id: 1 })).toBe(true);
    expect(isFluxyInboundEvent({ type: "tool_call", runId: "r1" })).toBe(true);
    expect(isFluxyInboundEvent({ type: "not_a_real_event" })).toBe(false);
    expect(isFluxyInboundEvent(null)).toBe(false);
  });

  it("recognizes outbound client events", () => {
    expect(isFluxyOutboundEvent({ type: "ping" })).toBe(true);
    expect(isFluxyOutboundEvent({ type: "stream", op: "start" })).toBe(true);
    expect(isFluxyOutboundEvent({ type: "message" })).toBe(true);
  });

  it("maps unknown inbound types to null", () => {
    expect(assertInboundEventType("presence")).toBe("presence");
    expect(assertInboundEventType("bogus")).toBeNull();
  });

  it("keeps inbound/outbound lists disjoint", () => {
    const overlap = FLUXY_INBOUND_EVENT_TYPES.filter((t) =>
      (FLUXY_OUTBOUND_EVENT_TYPES as readonly string[]).includes(t),
    );
    expect(overlap.sort()).toEqual([
      "agentTyping",
      "client_event",
      "edit",
      "location_track_ended",
      "location_update",
      "message",
      "stream",
      "typing",
    ]);
  });
});

describe("outbound client events", () => {
  it("matches Room DO handlers", () => {
    const roomDoTypes = [
      "ping",
      "message",
      "stream",
      "edit",
      "reaction",
      "read",
      "delete",
      "client_event",
      "location_update",
      "location_track_ended",
      "typing",
      "agentTyping",
    ];
    expect([...FLUXY_OUTBOUND_EVENT_TYPES].sort()).toEqual(roomDoTypes.sort());
  });
});
