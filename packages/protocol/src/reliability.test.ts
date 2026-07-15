import { describe, expect, it } from "vitest";
import {
  FLUXY_RELIABILITY_VERSION,
  FluxySequenceTracker,
  advanceDeliveryStage,
} from "./reliability.js";

describe("FluxySequenceTracker", () => {
  it("accepts contiguous events and detects duplicates and gaps", () => {
    const tracker = new FluxySequenceTracker();
    expect(tracker.inspect(1)).toEqual({ type: "accept", nextSequence: 1 });
    expect(tracker.inspect(1)).toEqual({ type: "duplicate", nextSequence: 1 });
    expect(tracker.inspect(3)).toEqual({
      type: "gap",
      expectedSequence: 2,
      receivedSequence: 3,
      nextSequence: 1,
    });
    expect(tracker.current).toBe(1);
  });

  it("restores and emits a versioned cursor", () => {
    const tracker = new FluxySequenceTracker();
    tracker.restore({ version: FLUXY_RELIABILITY_VERSION, roomId: "room", sequence: 41 });
    expect(tracker.inspect(42).type).toBe("accept");
    expect(tracker.cursor("room", "snapshot-1")).toEqual({
      version: FLUXY_RELIABILITY_VERSION,
      roomId: "room",
      sequence: 42,
      snapshotId: "snapshot-1",
    });
  });

  it("rejects unsafe sequence values", () => {
    const tracker = new FluxySequenceTracker();
    expect(() => tracker.inspect(0)).toThrow(TypeError);
    expect(() => tracker.inspect(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
  });
});

describe("delivery stages", () => {
  it("never regresses a receipt", () => {
    expect(advanceDeliveryStage("persisted", "accepted")).toBe("persisted");
    expect(advanceDeliveryStage("persisted", "delivered")).toBe("delivered");
    expect(advanceDeliveryStage(undefined, "accepted")).toBe("accepted");
  });
});
