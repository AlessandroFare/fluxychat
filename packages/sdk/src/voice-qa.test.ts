import { describe, it, expect } from "vitest";
import { createQaAnalyzer } from "./voice-qa";

describe("voice-qa", () => {
  it("should analyze a call and return results", () => {
    const qa = createQaAnalyzer();
    const result = qa.analyzeCall("call-1", [
      { speakerId: "A", startMs: 0, endMs: 1000, text: "Hello, how can I help you?" },
      { speakerId: "B", startMs: 1000, endMs: 3000, text: "I have a billing issue" },
    ]);
    expect(result.callId).toBe("call-1");
    expect(result.topics.length).toBeGreaterThan(0);
    expect(result.outcomes.length).toBeGreaterThan(0);
    expect(result.overallScore).toBeGreaterThan(0);
  });

  it("should submit human review", () => {
    const qa = createQaAnalyzer();
    qa.analyzeCall("call-1", [{ speakerId: "A", startMs: 0, endMs: 500, text: "hello" }]);
    qa.submitReview("call-1", { reviewerId: "reviewer-1", status: "approved", notes: "Looks good" });
    const result = qa.getResult("call-1");
    expect(result?.humanReview?.status).toBe("approved");
    expect(result?.humanReview?.reviewerId).toBe("reviewer-1");
  });

  it("should update scores", () => {
    const qa = createQaAnalyzer();
    qa.analyzeCall("call-1", [{ speakerId: "A", startMs: 0, endMs: 500, text: "hello" }]);
    qa.updateScores("call-1", { topics: [{ label: "custom", score: 85, confidence: 0.9, evidenceSpans: [] }] });
    const result = qa.getResult("call-1");
    expect(result?.topics).toHaveLength(1);
    expect(result?.topics[0].label).toBe("custom");
  });

  it("should list all results", () => {
    const qa = createQaAnalyzer();
    qa.analyzeCall("call-1", [{ speakerId: "A", startMs: 0, endMs: 500, text: "hello" }]);
    qa.analyzeCall("call-2", [{ speakerId: "A", startMs: 0, endMs: 500, text: "world" }]);
    expect(qa.listResults()).toHaveLength(2);
  });

  it("should throw for non-existent call on submitReview", () => {
    const qa = createQaAnalyzer();
    expect(() => qa.submitReview("no-call", { reviewerId: "r", status: "pending", notes: "" })).toThrow();
  });

  it("should throw for non-existent call on updateScores", () => {
    const qa = createQaAnalyzer();
    expect(() => qa.updateScores("no-call", {})).toThrow();
  });
});
