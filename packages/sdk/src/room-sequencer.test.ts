import { describe, it, expect } from "vitest";
import { createRoomSequencer } from "./room-sequencer";

describe("createRoomSequencer", () => {
  it("starts at 0", () => {
    const rs = createRoomSequencer();
    expect(rs.getCurrentSeq("room-1")).toBe(0);
  });

  it("nextSeq increments", () => {
    const rs = createRoomSequencer();
    expect(rs.nextSeq("room-1")).toBe(1);
    expect(rs.nextSeq("room-1")).toBe(2);
  });

  it("recordEvent returns sequenced event", () => {
    const rs = createRoomSequencer();
    const ev = rs.recordEvent("room-1", "message", "hello");
    expect(ev.seq).toBe(1);
    expect(ev.data).toBe("hello");
  });

  it("getEventsSince returns events after seq", () => {
    const rs = createRoomSequencer();
    rs.recordEvent("room-1", "msg", "a");
    rs.recordEvent("room-1", "msg", "b");
    const events = rs.getEventsSince("room-1", 1);
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe("b");
  });

  it("detectGaps finds missing sequences", () => {
    const rs = createRoomSequencer();
    const gaps = rs.detectGaps("room-1", [1, 3, 5]);
    expect(gaps).toEqual([2, 4]);
  });

  it("resetRoom clears state", () => {
    const rs = createRoomSequencer();
    rs.recordEvent("room-1", "msg", "a");
    rs.resetRoom("room-1");
    expect(rs.getCurrentSeq("room-1")).toBe(0);
  });

  it("getGapRanges reports gaps in event log", () => {
    const rs = createRoomSequencer();
    rs.recordEvent("room-1", "msg", "a");
    rs.recordEvent("room-1", "msg", "b");
    expect(rs.getGapRanges("room-1")).toHaveLength(0);
  });
});
