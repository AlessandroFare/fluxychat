import { describe, expect, it } from "vitest";
import { isCapabilityRealtimeEvent } from "./capability-realtime";

describe("room capability subscription contract", () => {
  it("detects capability_event frames for room connections", () => {
    expect(
      isCapabilityRealtimeEvent({
        type: "capability_event",
        roomId: "room-1",
        event: { type: "attendance.marked", roomId: "room-1", idempotencyKey: "k1", actor: { kind: "user", id: "u1" }, occurredAt: "2026-01-01T00:00:00Z", payload: {} },
      }),
    ).toBe(true);
  });
});
