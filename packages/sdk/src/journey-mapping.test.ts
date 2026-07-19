import { describe, it, expect } from "vitest";
import { createJourneyMapping } from "./journey-mapping";

describe("createJourneyMapping", () => {
  it("records and retrieves a journey step", () => {
    const jm = createJourneyMapping();
    const step = jm.recordStep("user-1", { channel: "web", action: "view", timestamp: 1000 });
    expect(step.id).toBeDefined();
    expect(step.channel).toBe("web");
  });

  it("getJourney returns full journey with steps", () => {
    const jm = createJourneyMapping();
    jm.recordStep("user-1", { channel: "web", action: "view", timestamp: 1000 });
    jm.recordStep("user-1", { channel: "mobile", action: "click", timestamp: 2000 });
    const journey = jm.getJourney("user-1");
    expect(journey).toBeDefined();
    expect(journey!.steps).toHaveLength(2);
    expect(journey!.touchpointCount).toBe(2);
  });

  it("listJourneys returns sorted by endTime", () => {
    const jm = createJourneyMapping();
    jm.recordStep("user-2", { channel: "web", action: "view", timestamp: 100 });
    jm.recordStep("user-1", { channel: "mobile", action: "click", timestamp: 200 });
    const list = jm.listJourneys();
    expect(list).toHaveLength(2);
    expect(list[0].userId).toBe("user-1");
  });

  it("getPaths returns transition paths", () => {
    const jm = createJourneyMapping();
    jm.recordStep("user-1", { channel: "web", action: "view", timestamp: 1000, durationMs: 500 });
    jm.recordStep("user-1", {
      channel: "mobile",
      action: "click",
      timestamp: 1500,
      durationMs: 300,
    });
    jm.recordStep("user-1", { channel: "web", action: "submit", timestamp: 1800 });
    const paths = jm.getPaths();
    expect(paths.length).toBeGreaterThanOrEqual(2);
    expect(paths[0].from).toBeDefined();
    expect(paths[0].to).toBeDefined();
  });

  it("getChannelSequence returns unique channels in order", () => {
    const jm = createJourneyMapping();
    jm.recordStep("user-1", { channel: "web", action: "a", timestamp: 1000 });
    jm.recordStep("user-1", { channel: "mobile", action: "b", timestamp: 2000 });
    jm.recordStep("user-1", { channel: "web", action: "c", timestamp: 3000 });
    expect(jm.getChannelSequence("user-1")).toEqual(["web", "mobile"]);
  });

  it("getAverageStepsPerJourney returns correct average", () => {
    const jm = createJourneyMapping();
    jm.recordStep("user-1", { channel: "web", action: "a", timestamp: 1000 });
    jm.recordStep("user-2", { channel: "web", action: "a", timestamp: 2000 });
    jm.recordStep("user-2", { channel: "mobile", action: "b", timestamp: 3000 });
    expect(jm.getAverageStepsPerJourney()).toBe(1.5);
  });

  it("clearUserJourney removes journey", () => {
    const jm = createJourneyMapping();
    jm.recordStep("user-1", { channel: "web", action: "a", timestamp: 1000 });
    jm.clearUserJourney("user-1");
    expect(jm.getJourney("user-1")).toBeUndefined();
  });
});
