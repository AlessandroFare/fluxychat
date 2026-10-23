import { describe, expect, it } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { evaluateAdaptiveGate, normalizeAdaptiveGates, offHoursMatch } from "./ops-adaptive-gates.js";

describe("ops-adaptive-gates", () => {
  it("normalizes config, dropping values out of range", () => {
    expect(normalizeAdaptiveGates(null)).toEqual({
      enabled: false,
      firstUse: false,
      offHours: null,
      spike: null,
      approveRoles: ["owner"],
    });
    const gates = normalizeAdaptiveGates({
      enabled: "true",
      firstUse: 1,
      offHours: { from: 20, to: 7 },
      spike: { multiplier: 3, windowMinutes: 60, lookbackHours: 24, minSamples: 5 },
      approveRoles: ["security", "", "  "],
    });
    expect(gates).toMatchObject({ enabled: true, firstUse: true, offHours: { from: 20, to: 7 }, approveRoles: ["security"] });
    expect(gates.spike).toEqual({ multiplier: 3, windowMinutes: 60, lookbackHours: 24, minSamples: 5 });

    expect(normalizeAdaptiveGates({ offHours: { from: 5, to: 5 } }).offHours).toBeNull();
    expect(normalizeAdaptiveGates({ offHours: { from: 24, to: 7 } }).offHours).toBeNull();
    expect(normalizeAdaptiveGates({ spike: { multiplier: 1, windowMinutes: 60, lookbackHours: 24, minSamples: 5 } }).spike).toBeNull();
    expect(normalizeAdaptiveGates({ spike: { multiplier: 3, windowMinutes: 0, lookbackHours: 24, minSamples: 5 } }).spike).toBeNull();
  });

  it("handles wrapping and non-wrapping off-hours ranges", () => {
    expect(offHoursMatch({ from: 20, to: 7 }, 22)).toBe(true);
    expect(offHoursMatch({ from: 20, to: 7 }, 6)).toBe(true);
    expect(offHoursMatch({ from: 20, to: 7 }, 12)).toBe(false);
    expect(offHoursMatch({ from: 8, to: 18 }, 9)).toBe(true);
    expect(offHoursMatch({ from: 8, to: 18 }, 18)).toBe(false);
    expect(offHoursMatch(null, 3)).toBe(false);
  });

  it("fires first_use only until the tool has actually run", async () => {
    const store = createMemoryOpsStore();
    const gates = { enabled: true, firstUse: true, offHours: null, spike: null, approveRoles: ["owner"] };
    expect(await evaluateAdaptiveGate(store, { projectId: "p1", tool: "files.search", gates })).toEqual(["first_use"]);
    await store.appendEvent({
      projectId: "p1",
      eventType: "ops.tool.called",
      result: { tool: "files.search" },
    });
    expect(await evaluateAdaptiveGate(store, { projectId: "p1", tool: "files.search", gates })).toEqual([]);
    // A different tool is still a first use.
    expect(await evaluateAdaptiveGate(store, { projectId: "p1", tool: "db.query_named_view", gates })).toEqual(["first_use"]);
  });

  it("is inert when disabled", async () => {
    const store = createMemoryOpsStore();
    expect(await evaluateAdaptiveGate(store, { projectId: "p1", tool: "files.search", gates: { enabled: false } })).toEqual([]);
  });

  it("fires off_hours using the injected clock", async () => {
    const store = createMemoryOpsStore();
    const gates = { enabled: true, firstUse: false, offHours: { from: 20, to: 7 }, spike: null, approveRoles: ["owner"] };
    const at22 = Date.UTC(2026, 9, 18, 22, 0, 0);
    const at12 = Date.UTC(2026, 9, 18, 12, 0, 0);
    expect(await evaluateAdaptiveGate(store, { projectId: "p1", tool: "files.search", gates, now: at22 })).toEqual(["off_hours"]);
    expect(await evaluateAdaptiveGate(store, { projectId: "p1", tool: "files.search", gates, now: at12 })).toEqual([]);
  });

  it("fires spike against the rolling baseline", async () => {
    const store = createMemoryOpsStore();
    const gates = { enabled: true, firstUse: false, offHours: null, spike: { multiplier: 3, windowMinutes: 60, lookbackHours: 6, minSamples: 4 }, approveRoles: ["owner"] };
    const now = Date.UTC(2026, 9, 18, 12, 0, 0);
    const callAt = (offsetMs) =>
      store.appendEvent({
        projectId: "p1",
        eventType: "ops.tool.called",
        result: { tool: "files.search" },
        createdAt: new Date(now - offsetMs).toISOString(),
      });
    // Baseline hours: 3 calls spread over the 5 lookback windows -> average under 1.
    await callAt(2 * 3_600_000);
    await callAt(2 * 3_600_000 + 60_000);
    await callAt(90 * 60_000);
    // 3 in the current hour: below minSamples, no spike.
    await callAt(120_000);
    await callAt(60_000);
    await callAt(30_000);
    expect(await evaluateAdaptiveGate(store, { projectId: "p1", tool: "files.search", gates, now })).toEqual([]);
    // 5 in the current hour (≥ minSamples 4 and > 3 × baseline 1): spike.
    await callAt(20_000);
    await callAt(10_000);
    expect(await evaluateAdaptiveGate(store, { projectId: "p1", tool: "files.search", gates, now })).toEqual(["spike"]);
  });
});
