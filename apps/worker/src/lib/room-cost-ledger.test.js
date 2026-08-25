import { describe, expect, it } from "vitest";
import {
  emptyLedger,
  recordWsFrameIn,
  recordWsFrameOut,
  recordDoRequest,
  recordAlarm,
  timed,
  merge,
  billableRequests,
  billableGbSeconds,
  costView,
  CF_PRICING,
} from "./room-cost-ledger.js";

describe("room-cost-ledger — counters", () => {
  it("starts empty", () => {
    const l = emptyLedger();
    expect(l.wsFramesIn).toBe(0);
    expect(l.wsFramesOut).toBe(0);
    expect(l.doRequests).toBe(0);
    expect(l.alarms).toBe(0);
    expect(l.handlerDurationMs).toBe(0);
  });

  it("counts WS frames in/out and DO requests", () => {
    const l = emptyLedger();
    recordWsFrameIn(l);
    recordWsFrameIn(l);
    recordWsFrameOut(l, 5);
    recordDoRequest(l);
    recordAlarm(l);
    expect(l.wsFramesIn).toBe(2);
    expect(l.wsFramesOut).toBe(5);
    expect(l.doRequests).toBe(1);
    expect(l.alarms).toBe(1);
  });

  it("times async handlers with timed()", async () => {
    const l = emptyLedger();
    await timed(l, async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(l.handlerDurationMs).toBeGreaterThanOrEqual(8);
    expect(l.handlerDurationMs).toBeLessThan(50);
  });

  it("merge adds counts and updates timestamps", () => {
    const live = emptyLedger(1000);
    recordWsFrameIn(live);
    recordWsFrameIn(live);
    // Test with synthetic values by directly overriding timestamps after merge
    const snapshot = { wsFramesIn: 5, wsFramesOut: 2, doRequests: 1, alarms: 1, handlerDurationMs: 100, windowStartMs: 500, lastEventMs: 2000 };
    merge(live, snapshot);
    expect(live.wsFramesIn).toBe(7);
    expect(live.wsFramesOut).toBe(2);
    expect(live.doRequests).toBe(1);
    expect(live.alarms).toBe(1);
    expect(live.handlerDurationMs).toBe(100);
    expect(live.windowStartMs).toBe(500);
    // lastEventMs is max(live's real Date.now(), snapshot's 2000) => real now
    expect(live.lastEventMs).toBeGreaterThanOrEqual(Date.now() - 1000);
  });

  it("ignores invalid snapshots on merge", () => {
    const live = emptyLedger();
    merge(live, null);
    merge(live, {});
    merge(live, { wsFramesIn: "bad" });
    expect(live.wsFramesIn).toBe(0);
  });
});

describe("room-cost-ledger — pricing", () => {
  it("bills WS frames at 20:1 ratio", () => {
    const l = emptyLedger();
    for (let i = 0; i < 40; i++) recordWsFrameIn(l);
    const b = billableRequests(l);
    expect(b.wsRequests).toBe(2);
    expect(b.total).toBe(2);
  });

  it("bills duration at 128 MB per DO", () => {
    const l = emptyLedger();
    l.handlerDurationMs = 1_000; // 1 second
    const gbs = billableGbSeconds(l);
    // 1s x 0.125 GB (128 MB / 1024)
    expect(Math.abs(gbs - 0.125)).toBeLessThan(0.00001);
  });

  it("costView reports withinIncludedAllowance for a tiny room", () => {
    const l = emptyLedger();
    recordWsFrameIn(l);
    recordWsFrameOut(l);
    const cv = costView(l);
    expect(cv.usage.billableRequests).toBe(1);
    expect(cv.estimatedUsd.withinIncludedAllowance).toBe(true);
    expect(cv.estimatedUsd.total).toBe(0);
  });

  it("costView accumulates monthly attribution correctly", () => {
    const l = emptyLedger();
    for (let i = 0; i < 100_000; i++) recordWsFrameIn(l);
    const cv = costView(l, { monthRequests: 1_000_000, monthGbSeconds: 400_000 });
    // 100k frames => 5k billable reqs. + 1M included = 1.005M total => 5k billed
    expect(cv.usage.billableRequests).toBe(5000);
    const cv2 = costView(l, { monthRequests: 999_999, monthGbSeconds: 0 });
    expect(cv2.estimatedUsd.withinIncludedAllowance).toBe(false);
    expect(cv2.estimatedUsd.requests).toBeGreaterThan(0);
  });

  it("duration billing kicks in after 400k GB-s included", () => {
    const l = emptyLedger();
    // Exactly 400k GB-s of room-attributed duration (no other attribution).
    l.handlerDurationMs = (400_000 / CF_PRICING.gbPerDurableObject) * 1000;
    const cv = costView(l, { monthGbSeconds: 0 });
    expect(cv.estimatedUsd.withinIncludedAllowance).toBe(true);
    // One more second pushes the room over the account allowance.
    l.handlerDurationMs += 1000;
    const cv2 = costView(l, { monthGbSeconds: 0 });
    expect(cv2.estimatedUsd.duration).toBeGreaterThan(0);
    expect(cv2.estimatedUsd.withinIncludedAllowance).toBe(false);
  });
});