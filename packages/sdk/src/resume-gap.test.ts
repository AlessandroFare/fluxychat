import { describe, expect, it } from "vitest";
import { FluxyResumeGapWalker } from "./resume-gap";

describe("FluxyResumeGapWalker", () => {
  it("seeds on the first seq instead of treating join as a hole", () => {
    const walker = new FluxyResumeGapWalker<string>("room");
    expect(walker.observe(12, "a")).toEqual({ kind: "deliver", events: ["a"] });
    expect(walker.currentSeq).toBe(12);
  });

  it("passes contiguous seq and skips duplicates", () => {
    const walker = new FluxyResumeGapWalker<string>("room");
    walker.observe(1, "one");
    expect(walker.observe(2, "two")).toEqual({ kind: "deliver", events: ["two"] });
    expect(walker.observe(2, "two-again")).toEqual({ kind: "duplicate" });
  });

  it("buffers a gap, applies missed, then drains live", () => {
    const walker = new FluxyResumeGapWalker<string>("room");
    walker.observe(1, "one");
    expect(walker.observe(3, "three")).toMatchObject({
      kind: "gap",
      expectedSeq: 2,
      receivedSeq: 3,
      resumeFrom: 1,
    });
    expect(walker.observe(4, "four")).toEqual({ kind: "hold" });
    expect(walker.applyMissed([{ seq: 2, event: "two" }])).toEqual(["two", "three", "four"]);
    expect(walker.currentSeq).toBe(4);
    expect(walker.isFilling).toBe(false);
  });

  it("jumps with discontinuity when the hole stays", () => {
    const walker = new FluxyResumeGapWalker<string>("room");
    walker.observe(1, "one");
    walker.observe(4, "four");
    const jump = walker.abandonGap();
    expect(jump.kind).toBe("discontinuity");
    expect(jump.expectedSeq).toBe(2);
    expect(jump.receivedSeq).toBe(4);
    expect(jump.events).toEqual(["four"]);
    expect(walker.currentSeq).toBe(4);
  });
});
