import { describe, expect, it } from "vitest";
import {
  FLUXY_ERROR_CATALOG,
  FLUXY_ERROR_CODES,
  FLUXY_INBOUND_EVENT_TYPES,
  FLUXY_OUTBOUND_EVENT_TYPES,
  FLUXY_PROTOCOL_INTEGER,
  FLUXY_PROTOCOL_VERSION,
  assertInboundEventType,
  fluxyErrorByCode,
  fluxyErrorByIdentifier,
  isFluxyInboundEvent,
  isFluxyOutboundEvent,
} from "./index.js";

describe("@fluxy-chat/protocol", () => {
  it("documents inbound guards used in the README", () => {
    expect(typeof isFluxyInboundEvent).toBe("function");
    expect(FLUXY_INBOUND_EVENT_TYPES).toContain("message");
    expect(FLUXY_INBOUND_EVENT_TYPES).toContain("tool_call");
  });

  it("exposes a stable protocol version", () => {
    expect(FLUXY_PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("FX-RTN-1 exposes an integer protocol revision", () => {
    expect(FLUXY_PROTOCOL_INTEGER).toBe(1);
    expect(FLUXY_INBOUND_EVENT_TYPES).toContain("occupancy");
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
      "cursor",
      "edit",
      "location_track_ended",
      "location_update",
      "message",
      "presence_patch",
      "room_reaction",
      "stream",
      "typing",
    ]);
  });
});

describe("error catalog", () => {
  it("maps refusal identifiers used on WebSocket close 1008", () => {
    expect(FLUXY_ERROR_CODES.not_member).toBe(40300);
    expect(fluxyErrorByIdentifier("token_expired")?.httpStatus).toBe(401);
    expect(fluxyErrorByCode(10200)?.identifier).toBe("discontinuity");
    expect(FLUXY_ERROR_CODES.feature_not_enabled).toBe(40040);
    expect(FLUXY_ERROR_CODES.resource_disposed).toBe(40041);
    expect(FLUXY_ERROR_CODES.message_not_found).toBe(40400);
  });

  it("gives every entry a docs href", () => {
    expect(FLUXY_ERROR_CATALOG.length).toBeGreaterThan(0);
    for (const entry of FLUXY_ERROR_CATALOG) {
      expect(entry.href).toContain(entry.identifier);
    }
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
      "cursor",
      "presence_patch",
      "agentTyping",
      "resume",
      "presence_state",
      "derived_set",
      "lock_acquire",
      "lock_release",
      "room_reaction",
      "presence_leave",
    ];
    expect([...FLUXY_OUTBOUND_EVENT_TYPES].sort()).toEqual(roomDoTypes.sort());
  });
});
