import { describe, it, expect } from "vitest";
import { createNoiseProcessor } from "./voice-noise";

describe("voice-noise", () => {
  it("should use defaults when no config given", () => {
    const np = createNoiseProcessor();
    const cfg = np.getConfig();
    expect(cfg.echoCancellation).toBe(true);
    expect(cfg.noiseSuppression).toBe(true);
    expect(cfg.suppressionLevel).toBe("moderate");
  });

  it("should merge partial config with defaults", () => {
    const np = createNoiseProcessor({ suppressionLevel: "high" });
    expect(np.getConfig().suppressionLevel).toBe("high");
    expect(np.getConfig().echoCancellation).toBe(true);
  });

  it("should update config fields", () => {
    const np = createNoiseProcessor();
    np.updateConfig({ echoCancellation: false, gainControlTarget: 0.8 });
    expect(np.getConfig().echoCancellation).toBe(false);
    expect(np.getConfig().gainControlTarget).toBe(0.8);
    expect(np.getConfig().noiseSuppression).toBe(true);
  });

  it("should return empty devices list when no navigator", async () => {
    const np = createNoiseProcessor();
    const devices = await np.getAvailableDevices("audioinput");
    expect(Array.isArray(devices)).toBe(true);
  });

  it("should return null diagnostics for unknown device", async () => {
    const np = createNoiseProcessor();
    const diag = await np.getDiagnostics("unknown-device");
    expect(diag).toBeNull();
  });

  it("should test latency", async () => {
    const np = createNoiseProcessor();
    const latency = await np.testLatency("dev-1");
    expect(latency).toBeGreaterThanOrEqual(5);
    expect(latency).toBeLessThanOrEqual(25);
  });
});
