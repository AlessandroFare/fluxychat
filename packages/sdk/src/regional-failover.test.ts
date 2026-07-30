import { describe, it, expect } from "vitest";
import { createRegionalFailover } from "./regional-failover";

describe("createRegionalFailover", () => {
  it("manages regions", () => {
    const rf = createRegionalFailover();
    rf.addRegion({ id: "us-east", name: "US East", priority: 1, active: true });
    rf.addRegion({ id: "eu-west", name: "EU West", priority: 2, active: true });
    expect(rf.getState().availableRegions).toHaveLength(2);
    expect(rf.getState().currentRegion).toBe("us-east");
  });

  it("failover moves to next region", () => {
    const rf = createRegionalFailover();
    rf.addRegion({ id: "us-east", name: "US East", priority: 1, active: true });
    rf.addRegion({ id: "eu-west", name: "EU West", priority: 2, active: true });
    const next = rf.failover();
    expect(next).toBe("eu-west");
    expect(rf.getState().failoverCount).toBe(1);
  });

  it("failover returns null at last region", () => {
    const rf = createRegionalFailover();
    rf.addRegion({ id: "us-east", name: "US East", priority: 1, active: true });
    rf.failover();
    expect(rf.failover()).toBeNull();
  });

  it("getOptimalRegion picks lowest latency", () => {
    const rf = createRegionalFailover();
    rf.addRegion({ id: "us-east", name: "US East", priority: 1, active: true });
    rf.addRegion({ id: "eu-west", name: "EU West", priority: 2, active: true });
    rf.setLatency("us-east", 100);
    rf.setLatency("eu-west", 50);
    expect(rf.getOptimalRegion()).toBe("eu-west");
  });

  it("triggers failover callback", () => {
    const rf = createRegionalFailover();
    rf.addRegion({ id: "us-east", name: "US East", priority: 1, active: true });
    rf.addRegion({ id: "eu-west", name: "EU West", priority: 2, active: true });
    const calls: string[] = [];
    rf.onFailover((from, to) => calls.push(`${from}->${to}`));
    rf.failover();
    expect(calls).toEqual(["us-east->eu-west"]);
  });

  it("reset clears state", () => {
    const rf = createRegionalFailover();
    rf.addRegion({ id: "us-east", name: "US East", priority: 1, active: true });
    rf.failover();
    rf.reset();
    expect(rf.getState().failoverCount).toBe(0);
  });
});
