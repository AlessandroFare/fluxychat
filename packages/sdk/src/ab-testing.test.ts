import { describe, it, expect } from "vitest";
import { createAbTestingEngine } from "./ab-testing";

describe("createAbTestingEngine", () => {
  it("creates a test in draft status", () => {
    const ab = createAbTestingEngine();
    const test = ab.createTest({
      name: "Test 1",
      variants: [
        { id: "a", name: "Control", config: { theme: "light" }, trafficPercent: 50 },
        { id: "b", name: "Variant", config: { theme: "dark" }, trafficPercent: 50 },
      ],
      metric: "click_rate",
      minSampleSize: 100,
    });
    expect(test.status).toBe("draft");
    expect(test.id).toBeDefined();
  });

  it("startTest sets status to running", () => {
    const ab = createAbTestingEngine();
    const test = ab.createTest({
      name: "Test 1",
      variants: [
        { id: "a", name: "Control", config: {}, trafficPercent: 50 },
        { id: "b", name: "Variant", config: {}, trafficPercent: 50 },
      ],
      metric: "click_rate",
      minSampleSize: 100,
    });
    ab.startTest(test.id);
    expect(ab.getTest(test.id)!.status).toBe("running");
  });

  it("pauseTest sets status to paused", () => {
    const ab = createAbTestingEngine();
    const test = ab.createTest({
      name: "Test 1",
      variants: [
        { id: "a", name: "Control", config: {}, trafficPercent: 50 },
        { id: "b", name: "Variant", config: {}, trafficPercent: 50 },
      ],
      metric: "click_rate",
      minSampleSize: 100,
    });
    ab.pauseTest(test.id);
    expect(ab.getTest(test.id)!.status).toBe("paused");
  });

  it("completeTest sets status to completed", () => {
    const ab = createAbTestingEngine();
    const test = ab.createTest({
      name: "Test 1",
      variants: [
        { id: "a", name: "Control", config: {}, trafficPercent: 50 },
        { id: "b", name: "Variant", config: {}, trafficPercent: 50 },
      ],
      metric: "click_rate",
      minSampleSize: 100,
    });
    ab.completeTest(test.id);
    expect(ab.getTest(test.id)!.status).toBe("completed");
    expect(ab.getTest(test.id)!.endedAt).toBeDefined();
  });

  it("assignVariant throws for draft tests", () => {
    const ab = createAbTestingEngine();
    const test = ab.createTest({
      name: "Test 1",
      variants: [
        { id: "a", name: "Control", config: {}, trafficPercent: 100 },
      ],
      metric: "click_rate",
      minSampleSize: 100,
    });
    expect(() => ab.assignVariant(test.id)).toThrow('is not running');
  });

  it("assignVariant returns a variant for running tests", () => {
    const ab = createAbTestingEngine();
    const test = ab.createTest({
      name: "Test 1",
      variants: [
        { id: "a", name: "Control", config: {}, trafficPercent: 50 },
        { id: "b", name: "Variant", config: {}, trafficPercent: 50 },
      ],
      metric: "click_rate",
      minSampleSize: 100,
    });
    ab.startTest(test.id);
    const variant = ab.assignVariant(test.id);
    expect(["a", "b"]).toContain(variant.id);
  });

  it("recordExposure and recordConversion track metrics", () => {
    const ab = createAbTestingEngine();
    const test = ab.createTest({
      name: "Test 1",
      variants: [
        { id: "a", name: "Control", config: {}, trafficPercent: 100 },
      ],
      metric: "click_rate",
      minSampleSize: 100,
    });
    ab.startTest(test.id);
    ab.recordExposure(test.id, "a");
    ab.recordExposure(test.id, "a");
    ab.recordConversion(test.id, "a");
    const results = ab.getResults(test.id);
    expect(results).toHaveLength(1);
    expect(results[0].exposures).toBe(2);
    expect(results[0].conversions).toBe(1);
    expect(results[0].conversionRate).toBe(0.5);
  });

  it("listTests returns all tests", () => {
    const ab = createAbTestingEngine();
    ab.createTest({
      name: "Test A",
      variants: [{ id: "a", name: "A", config: {}, trafficPercent: 100 }],
      metric: "click_rate",
      minSampleSize: 100,
    });
    ab.createTest({
      name: "Test B",
      variants: [{ id: "a", name: "A", config: {}, trafficPercent: 100 }],
      metric: "satisfaction_score",
      minSampleSize: 50,
    });
    expect(ab.listTests()).toHaveLength(2);
  });

  it("deleteTest removes test", () => {
    const ab = createAbTestingEngine();
    const test = ab.createTest({
      name: "Test 1",
      variants: [{ id: "a", name: "A", config: {}, trafficPercent: 100 }],
      metric: "click_rate",
      minSampleSize: 100,
    });
    expect(ab.deleteTest(test.id)).toBe(true);
    expect(ab.listTests()).toHaveLength(0);
  });
});
