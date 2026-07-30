import { describe, it, expect } from "vitest";
import { createDiarizer } from "./voice-diarization";

describe("voice-diarization", () => {
  it("should create a session", () => {
    const d = createDiarizer();
    d.createSession("call-1");
    expect(d.getSpeakerCount("call-1")).toBe(0);
  });

  it("should add a segment with auto-assigned speaker", () => {
    const d = createDiarizer();
    d.createSession("call-1");
    const seg = d.addSegment("call-1", { startMs: 0, endMs: 1000, confidence: 0.9, text: "hello" });
    expect(seg.speakerId).toMatch(/^SPEAKER_\d{2}$/);
    expect(d.getSpeakerCount("call-1")).toBe(1);
  });

  it("should add a segment with explicit speaker", () => {
    const d = createDiarizer();
    d.createSession("call-1");
    const seg = d.addSegment("call-1", { speakerId: "Alice", startMs: 0, endMs: 1000, confidence: 0.9, text: "hello" });
    expect(seg.speakerId).toBe("Alice");
  });

  it("should assign speaker to existing segment", () => {
    const d = createDiarizer();
    d.createSession("call-1");
    d.addSegment("call-1", { startMs: 0, endMs: 1000, confidence: 0.9, text: "hello" });
    d.assignSpeaker("call-1", 0, "Bob");
    const result = d.getResult("call-1");
    expect(result?.segments[0].speakerId).toBe("Bob");
  });

  it("should merge segments", () => {
    const d = createDiarizer();
    d.createSession("call-1");
    d.addSegment("call-1", { startMs: 0, endMs: 500, confidence: 0.9, text: "hello" });
    d.addSegment("call-1", { startMs: 500, endMs: 1000, confidence: 0.8, text: "world" });
    d.mergeSegments("call-1", 1, 0);
    expect(d.getResult("call-1")!.segments).toHaveLength(1);
    expect(d.getResult("call-1")!.segments[0].text).toBe("hello world");
  });

  it("should detect overlaps", () => {
    const d = createDiarizer();
    d.createSession("call-1");
    d.addSegment("call-1", { speakerId: "A", startMs: 0, endMs: 1000, confidence: 0.9, text: "hello" });
    d.addSegment("call-1", { speakerId: "B", startMs: 500, endMs: 1500, confidence: 0.8, text: "world" });
    const result = d.getResult("call-1");
    expect(result?.overlaps.length).toBeGreaterThan(0);
    expect(result?.overlaps[0].speakers).toContain("A");
    expect(result?.overlaps[0].speakers).toContain("B");
  });

  it("should close a session", () => {
    const d = createDiarizer();
    d.createSession("call-1");
    d.closeSession("call-1");
    expect(d.getResult("call-1")).toBeNull();
  });

  it("should throw for non-existent session", () => {
    const d = createDiarizer();
    expect(() => d.addSegment("no-session", { startMs: 0, endMs: 100, confidence: 0.9, text: "x" })).toThrow();
  });
});
