import { describe, expect, it } from "vitest";
import {
  classifyAnonymousFeedback,
  resolveFeedbackPath,
  ESCALATION_CONFIDENCE_THRESHOLD,
} from "./anonymous-feedback-classifier.js";

describe("anonymous-feedback-classifier", () => {
  it("uses heuristic when AI is not configured", async () => {
    const result = await classifyAnonymousFeedback({}, "My manager harasses me weekly");
    expect(result.category).toBe("harassment");
    expect(result.source).toBe("heuristic");
  });

  it("routes sensitive categories to hr_escalation with biased threshold", () => {
    const routed = resolveFeedbackPath({ category: "harassment", confidence: 0.5 });
    expect(routed.path).toBe("hr_escalation");
    expect(ESCALATION_CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(0.5);
  });

  it("routes general feedback to aggregated_summary", () => {
    const routed = resolveFeedbackPath({ category: "general", confidence: 0.9 });
    expect(routed.path).toBe("aggregated_summary");
  });

  it("escalates low-confidence harassment (when in doubt)", () => {
    const routed = resolveFeedbackPath({ category: "harassment", confidence: 0.4 });
    expect(routed.path).toBe("hr_escalation");
  });
});
