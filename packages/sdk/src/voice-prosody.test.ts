import { describe, it, expect } from "vitest";
import { createProsodyController } from "./voice-prosody";

describe("voice-prosody", () => {
  it("should return default config", () => {
    const pc = createProsodyController();
    const cfg = pc.getConfig();
    expect(cfg.style).toBe("neutral");
    expect(cfg.rate).toBe("normal");
    expect(cfg.pitch).toBe("normal");
  });

  it("should merge partial config", () => {
    const pc = createProsodyController({ defaultConfig: { style: "happy", rate: "fast", pitch: "high" } });
    const cfg = pc.getConfig();
    expect(cfg.style).toBe("happy");
    expect(cfg.rate).toBe("fast");
  });

  it("should clamp to safety boundary", () => {
    const pc = createProsodyController({
      safetyBoundary: { maxRate: "slow", minRate: "x-slow", maxPitch: "normal", minPitch: "x-low", allowedStyles: ["neutral", "calm"] },
    });
    const cfg = pc.setConfig({ rate: "x-fast", pitch: "x-high", style: "shout" });
    expect(cfg.rate).toBe("slow");
    expect(cfg.pitch).toBe("normal");
    expect(cfg.style).toBe("neutral");
  });

  it("should not exceed safety boundary", () => {
    const pc = createProsodyController({ safetyBoundary: { maxRate: "normal", minRate: "normal", maxPitch: "normal", minPitch: "normal", allowedStyles: ["neutral"] } });
    const cfg = pc.setConfig({ rate: "fast", pitch: "high", style: "happy" });
    expect(cfg.rate).toBe("normal");
    expect(cfg.pitch).toBe("normal");
    expect(cfg.style).toBe("neutral");
  });

  it("should reset config to defaults", () => {
    const pc = createProsodyController();
    pc.setConfig({ style: "whisper", rate: "x-slow" });
    pc.resetConfig();
    expect(pc.getConfig().style).toBe("neutral");
    expect(pc.getConfig().rate).toBe("normal");
  });

  it("should return available providers", () => {
    const pc = createProsodyController({ providerPriority: ["elevenlabs", "openai"] });
    expect(pc.getAvailableProviders()).toEqual(["elevenlabs", "openai"]);
  });

  it("should return safety boundary", () => {
    const pc = createProsodyController();
    const boundary = pc.getSafetyBoundary();
    expect(boundary.allowedStyles).toContain("neutral");
  });

  it("should synthesize empty buffer", async () => {
    const pc = createProsodyController();
    const buf = await pc.synthesize("openai", "hello");
    expect(buf.byteLength).toBe(0);
  });
});
