import { describe, it, expect } from "vitest";
import { createSloTracker } from "./voice-slo";

describe("voice-slo", () => {
  it("should start empty", () => {
    const t = createSloTracker();
    expect(t.getSpans()).toEqual([]);
  });

  it("should record spans", () => {
    const t = createSloTracker();
    t.addSpan({ phase: "asr", startMs: 0, endMs: 100, durationMs: 100, sessionId: "s1" });
    expect(t.getSpans()).toHaveLength(1);
  });

  it("should filter spans by phase", () => {
    const t = createSloTracker();
    t.addSpan({ phase: "asr", startMs: 0, endMs: 100, durationMs: 100, sessionId: "s1" });
    t.addSpan({ phase: "tts", startMs: 100, endMs: 200, durationMs: 100, sessionId: "s1" });
    expect(t.getSpans("asr")).toHaveLength(1);
    expect(t.getSpans("tts")).toHaveLength(1);
  });

  it("should compute percentile reports", () => {
    const t = createSloTracker();
    for (let i = 0; i < 100; i++) {
      t.addSpan({ phase: "asr", startMs: 0, endMs: i, durationMs: i, sessionId: "s1" });
    }
    const report = t.getReport("asr");
    expect(report.count).toBe(100);
    expect(report.percentile.p95).toBeGreaterThan(90);
    expect(report.percentile.p99).toBeGreaterThan(95);
  });

  it("should compute p95 latency", () => {
    const t = createSloTracker();
    for (let i = 0; i < 100; i++) {
      t.addSpan({ phase: "llm", startMs: 0, endMs: i * 2, durationMs: i * 2, sessionId: "s1" });
    }
    const p95 = t.getP95Latency("llm");
    expect(p95).toBeGreaterThan(0);
  });

  it("should return all reports", () => {
    const t = createSloTracker();
    t.addSpan({ phase: "mic", startMs: 0, endMs: 10, durationMs: 10, sessionId: "s1" });
    t.addSpan({ phase: "asr", startMs: 10, endMs: 50, durationMs: 40, sessionId: "s1" });
    const reports = t.getAllReports();
    expect(reports).toHaveLength(2);
  });

  it("should return empty report for missing phase", () => {
    const t = createSloTracker();
    const report = t.getReport("speaker");
    expect(report.count).toBe(0);
    expect(report.meanMs).toBe(0);
    expect(report.percentile.p95).toBe(0);
  });

  it("should reset", () => {
    const t = createSloTracker();
    t.addSpan({ phase: "asr", startMs: 0, endMs: 100, durationMs: 100, sessionId: "s1" });
    t.reset();
    expect(t.getSpans()).toEqual([]);
  });
});
