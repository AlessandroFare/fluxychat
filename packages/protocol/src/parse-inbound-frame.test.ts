import { describe, expect, it } from "vitest";
import { parseInboundWsFrame, isKnownOutboundClientEvent } from "./parse-inbound-frame.js";
import { isValidLocationTrackEnded, isValidLocationUpdate } from "./location-events.js";

describe("parseInboundWsFrame", () => {
  it("parses pong", () => {
    expect(parseInboundWsFrame(JSON.stringify({ type: "pong", ts: 1 }))).toEqual({ kind: "pong" });
  });

  it("parses replay snapshot", () => {
    expect(parseInboundWsFrame(JSON.stringify({ type: "replay", messages: [{ id: 1 }] }))).toEqual({
      kind: "replay",
      messages: [{ id: 1 }],
    });
  });

  it("parses deliverable events", () => {
    const frame = parseInboundWsFrame(JSON.stringify({ type: "message", id: 2, content: "hi" }));
    expect(frame?.kind).toBe("event");
    expect(frame?.event?.type).toBe("message");
  });

  it("parses worker streaming edit broadcasts", () => {
    const frame = parseInboundWsFrame(
      JSON.stringify({
        type: "edit",
        id: 42,
        roomId: "room-a",
        userId: "bot-1",
        content: "Hello",
        editedAt: "2026-07-31T19:00:00.000Z",
        streaming: false,
      }),
    );
    expect(frame?.kind).toBe("event");
    expect(frame?.event?.type).toBe("edit");
    expect(frame?.event?.content).toBe("Hello");
  });

  it("passthrough unknown inbound types (forward-compat)", () => {
    const raw = JSON.stringify({ type: "totally_unknown", v: 2, payload: { ok: true } });
    expect(parseInboundWsFrame(raw)).toEqual({
      kind: "unknown",
      frame: { type: "totally_unknown", v: 2, payload: { ok: true } },
    });
  });

  it("returns null on invalid JSON", () => {
    expect(parseInboundWsFrame("{")).toBeNull();
  });
});

describe("isKnownOutboundClientEvent", () => {
  it("accepts room DO client events", () => {
    expect(isKnownOutboundClientEvent({ type: "message", content: "x" })).toBe(true);
    expect(isKnownOutboundClientEvent({ type: "edit", id: 1 })).toBe(true);
  });

  it("rejects unknown outbound types", () => {
    expect(isKnownOutboundClientEvent({ type: "subscribe" })).toBe(false);
    expect(isKnownOutboundClientEvent(null)).toBe(false);
  });

  it("validates bounded location events", () => {
    expect(isValidLocationUpdate({
      type: "location_update",
      trackId: "courier:42",
      latitude: 45.4642,
      longitude: 9.19,
      accuracy: 8,
      timestamp: "2026-07-10T10:00:00.000Z",
    })).toBe(true);
    expect(isValidLocationUpdate({
      type: "location_update",
      trackId: "courier:42",
      latitude: 91,
      longitude: 9.19,
    })).toBe(false);
    expect(isValidLocationTrackEnded({
      type: "location_track_ended",
      trackId: "courier:42",
    })).toBe(true);
  });
});
