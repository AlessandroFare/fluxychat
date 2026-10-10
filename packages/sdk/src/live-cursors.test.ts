import { describe, expect, it, vi } from "vitest";
import {
  buildCursorBatchOutbound,
  buildCursorOutbound,
  clampCursorCoordinate,
  createCursorBatcher,
  createCursorDispenser,
  parseCursorBatchPoints,
  parseLiveCursorEvent,
  shouldSendCursor,
} from "./live-cursors";

describe("live cursors", () => {
  it("parses inbound cursor frames", () => {
    expect(
      parseLiveCursorEvent({
        type: "cursor",
        userId: "ada",
        x: 10,
        y: 20,
        label: "Ada",
      }),
    ).toMatchObject({ userId: "ada", x: 10, y: 20, label: "Ada" });
  });

  it("rejects invalid frames", () => {
    expect(parseLiveCursorEvent({ type: "typing" })).toBeNull();
    expect(parseLiveCursorEvent({ type: "cursor", userId: "ada" })).toBeNull();
  });

  it("builds a bounded outbound payload", () => {
    expect(buildCursorOutbound({ x: 1e9, y: -3, label: "x".repeat(80) })).toMatchObject({
      type: "cursor",
      x: 1e6,
      y: -3,
    });
    expect(String(buildCursorOutbound({ x: 0, y: 0, label: "x".repeat(80) }).label)).toHaveLength(64);
  });

  it("clamps non-finite coordinates", () => {
    expect(clampCursorCoordinate(Number.NaN)).toBe(0);
  });

  it("skips publish when occupancy says we are alone", () => {
    expect(shouldSendCursor({ online: 1, presenceCount: 1 })).toBe(false);
    expect(shouldSendCursor({ online: 2 })).toBe(true);
    expect(shouldSendCursor({})).toBe(true);
  });

  it("batches points into one frame with offsets", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const batcher = createCursorBatcher(100);
    batcher.publish({ x: 1, y: 1 }, send);
    vi.advanceTimersByTime(40);
    batcher.publish({ x: 2, y: 3 }, send);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60);
    expect(send).toHaveBeenCalledTimes(1);
    const frame = send.mock.calls[0]![0] as Record<string, unknown>;
    expect(frame.type).toBe("cursor");
    expect(frame.x).toBe(2);
    expect(Array.isArray(frame.positions)).toBe(true);
    expect((frame.positions as unknown[]).length).toBe(2);
    batcher.dispose();
    vi.useRealTimers();
  });

  it("does not send a batch when shouldSend is false", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const batcher = createCursorBatcher(50);
    batcher.publish({ x: 1, y: 1 }, send, { shouldSend: false });
    vi.advanceTimersByTime(50);
    expect(send).not.toHaveBeenCalled();
    batcher.dispose();
    vi.useRealTimers();
  });

  it("replays inbound offsets in order", () => {
    vi.useFakeTimers();
    const applied: Array<{ x: number; y: number }> = [];
    const dispenser = createCursorDispenser((c) => applied.push({ x: c.x, y: c.y }));
    dispenser.ingest({
      type: "cursor",
      userId: "ada",
      x: 8,
      y: 9,
      positions: [
        { x: 1, y: 1, offsetMs: 0 },
        { x: 8, y: 9, offsetMs: 30 },
      ],
    });
    expect(applied).toEqual([]);
    vi.advanceTimersByTime(0);
    expect(applied).toEqual([{ x: 1, y: 1 }]);
    vi.advanceTimersByTime(30);
    expect(applied).toEqual([
      { x: 1, y: 1 },
      { x: 8, y: 9 },
    ]);
    dispenser.dispose();
    vi.useRealTimers();
  });

  it("parses and builds batch positions", () => {
    const frame = buildCursorBatchOutbound(
      [
        { x: 1, y: 2, offsetMs: 0 },
        { x: 3, y: 4, offsetMs: 15 },
      ],
      { label: "Ada" },
    );
    expect(parseCursorBatchPoints(frame)?.map((p) => p.x)).toEqual([1, 3]);
  });
});
