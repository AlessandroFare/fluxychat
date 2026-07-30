import { describe, it, expect } from "vitest";
import { createQualityCollector } from "./voice-quality-dashboard";

describe("voice-quality-dashboard", () => {
  it("should start empty", () => {
    const c = createQualityCollector();
    expect(c.getSnapshots()).toEqual([]);
  });

  it("should record snapshots", () => {
    const c = createQualityCollector();
    c.record({ ttfaMs: 200, asrWerProxy: 0.05, eotDelayMs: 150, interruptionPrecision: 0.9, jitterMs: 10, packetLoss: 0.01, deviceId: "dev-1" });
    expect(c.getSnapshots()).toHaveLength(1);
  });

  it("should filter snapshots by device", () => {
    const c = createQualityCollector();
    c.record({ ttfaMs: 200, asrWerProxy: 0.05, eotDelayMs: 150, interruptionPrecision: 0.9, jitterMs: 10, packetLoss: 0.01, deviceId: "dev-1" });
    c.record({ ttfaMs: 300, asrWerProxy: 0.08, eotDelayMs: 200, interruptionPrecision: 0.8, jitterMs: 20, packetLoss: 0.02, deviceId: "dev-2" });
    expect(c.getSnapshots("dev-1")).toHaveLength(1);
    expect(c.getSnapshots("dev-2")).toHaveLength(1);
  });

  it("should compute quality report", () => {
    const c = createQualityCollector();
    c.record({ ttfaMs: 200, asrWerProxy: 0.05, eotDelayMs: 150, interruptionPrecision: 0.9, jitterMs: 10, packetLoss: 0.01, deviceId: "dev-1" });
    c.record({ ttfaMs: 400, asrWerProxy: 0.15, eotDelayMs: 250, interruptionPrecision: 0.7, jitterMs: 30, packetLoss: 0.03, deviceId: "dev-1" });
    const report = c.getReport();
    expect(report.totalSnapshots).toBe(2);
    expect(report.avgTtfaMs).toBe(300);
    expect(report.avgWerProxy).toBe(0.1);
    expect(report.byDevice).toHaveLength(1);
  });

  it("should return empty report with no snapshots", () => {
    const c = createQualityCollector();
    const report = c.getReport();
    expect(report.totalSnapshots).toBe(0);
    expect(report.byDevice).toEqual([]);
  });

  it("should break down by device", () => {
    const c = createQualityCollector();
    c.record({ ttfaMs: 200, asrWerProxy: 0.05, eotDelayMs: 150, interruptionPrecision: 0.9, jitterMs: 10, packetLoss: 0.01, deviceId: "dev-1" });
    c.record({ ttfaMs: 300, asrWerProxy: 0.08, eotDelayMs: 200, interruptionPrecision: 0.8, jitterMs: 20, packetLoss: 0.02, deviceId: "dev-2" });
    expect(c.getReport().byDevice).toHaveLength(2);
  });

  it("should reset", () => {
    const c = createQualityCollector();
    c.record({ ttfaMs: 200, asrWerProxy: 0.05, eotDelayMs: 150, interruptionPrecision: 0.9, jitterMs: 10, packetLoss: 0.01, deviceId: "dev-1" });
    c.reset();
    expect(c.getSnapshots()).toEqual([]);
  });
});
