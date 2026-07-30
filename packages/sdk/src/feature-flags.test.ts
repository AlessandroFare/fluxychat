import { describe, it, expect } from "vitest";
import { createFeatureFlagManager } from "./feature-flags";

describe("feature-flags", () => {
  it("should create a flag", () => {
    const f = createFeatureFlagManager();
    const flag = f.createFlag({ flagId: "new-ui", name: "New UI", description: "New UI redesign", status: "enabled", rolloutPercent: 50, tenantIds: [], killSwitch: false, metricGuardrails: [] });
    expect(flag.flagId).toBe("new-ui");
  });

  it("should evaluate enabled for matching tenant", () => {
    const f = createFeatureFlagManager();
    f.createFlag({ flagId: "flag-1", name: "Flag 1", description: "", status: "enabled", rolloutPercent: 100, tenantIds: ["tenant-1"], killSwitch: false, metricGuardrails: [] });
    const eval_ = f.isEnabled("flag-1", "tenant-1");
    expect(eval_.enabled).toBe(true);
  });

  it("should evaluate disabled for non-matching tenant", () => {
    const f = createFeatureFlagManager();
    f.createFlag({ flagId: "flag-1", name: "Flag 1", description: "", status: "enabled", rolloutPercent: 100, tenantIds: ["tenant-1"], killSwitch: false, metricGuardrails: [] });
    const eval_ = f.isEnabled("flag-1", "tenant-2");
    expect(eval_.enabled).toBe(false);
  });

  it("should kill switch disable a flag", () => {
    const f = createFeatureFlagManager();
    f.createFlag({ flagId: "flag-1", name: "Flag 1", description: "", status: "enabled", rolloutPercent: 100, tenantIds: [], killSwitch: false, metricGuardrails: [] });
    f.setKillSwitch("flag-1", true);
    expect(f.isEnabled("flag-1", "any").enabled).toBe(false);
  });

  it("should delete a flag", () => {
    const f = createFeatureFlagManager();
    f.createFlag({ flagId: "f1", name: "F1", description: "", status: "enabled", rolloutPercent: 100, tenantIds: [], killSwitch: false, metricGuardrails: [] });
    f.deleteFlag("f1");
    expect(f.getFlag("f1")).toBeNull();
  });

  it("should trigger guardrail and auto-disable", () => {
    const f = createFeatureFlagManager();
    f.createFlag({ flagId: "perf-test", name: "Perf", description: "", status: "enabled", rolloutPercent: 100, tenantIds: [], killSwitch: false, metricGuardrails: [{ metricName: "error_rate", threshold: 5, operator: "gt", cooldownMs: 60000 }] });
    f.recordMetric("perf-test", "error_rate", 10);
    expect(f.getFlag("perf-test")?.killSwitch).toBe(true);
  });
});
