import { describe, expect, it } from "vitest";
import {
  isValidServerRealtimeEventFrame,
  parseServerRealtimeEventFrame,
} from "./server-realtime-events.js";

describe("server_event envelope conformance", () => {
  it("accepts a valid server_event frame", () => {
    const frame = {
      type: "server_event",
      roomId: "room-1",
      name: "poll.created",
      data: { pollId: "p1" },
      userId: "u1",
    };
    expect(isValidServerRealtimeEventFrame(frame)).toBe(true);
    expect(parseServerRealtimeEventFrame(frame)).toEqual(frame);
  });

  it("accepts frames without userId", () => {
    const frame = {
      type: "server_event",
      roomId: "live-abc",
      name: "live.event_live",
      data: { eventId: "le_1", status: "live" },
    };
    expect(isValidServerRealtimeEventFrame(frame)).toBe(true);
  });

  it("rejects wrong type", () => {
    expect(isValidServerRealtimeEventFrame({ type: "message", roomId: "r", name: "x", data: {} })).toBe(false);
  });

  it("rejects missing or empty roomId", () => {
    expect(isValidServerRealtimeEventFrame({ type: "server_event", roomId: "", name: "n", data: {} })).toBe(false);
    expect(isValidServerRealtimeEventFrame({ type: "server_event", name: "n", data: {} })).toBe(false);
  });

  it("rejects non-object data", () => {
    expect(isValidServerRealtimeEventFrame({
      type: "server_event",
      roomId: "r",
      name: "game.tick",
      data: null,
    })).toBe(false);
  });

  it("rejects invalid userId type", () => {
    expect(isValidServerRealtimeEventFrame({
      type: "server_event",
      roomId: "r",
      name: "collab.crdt_update",
      data: {},
      userId: 42,
    })).toBe(false);
  });

  it("parse returns null for invalid frames", () => {
    expect(parseServerRealtimeEventFrame("{")).toBeNull();
    expect(parseServerRealtimeEventFrame(null)).toBeNull();
  });
});
