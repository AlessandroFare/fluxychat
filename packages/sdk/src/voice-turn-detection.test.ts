import { describe, it, expect } from "vitest";
import { createTurnDetector } from "./voice-turn-detection";

describe("voice-turn-detection", () => {
  it("should detect speech start on high energy", () => {
    const td = createTurnDetector();
    const event = td.processAudio(0.5);
    expect(event?.type).toBe("speech_start");
  });

  it("should detect false cut for short speech", () => {
    const td = createTurnDetector();
    td.processAudio(0.5);
    const event = td.processAudio(0.01);
    expect(event?.type).toBe("false_cut");
  });

  it("should detect utterance after silence timeout", () => {
    const td = createTurnDetector({
      vad: { energyThreshold: 0.02, silenceTimeoutMs: 10, minSpeechDurationMs: 0, minSilenceDurationMs: 0, debounceMs: 5 },
      dynamicEndpointing: { enabled: true, minSilenceMs: 0, maxSilenceMs: 100, adaptationRate: 0.1 },
    });
    td.processAudio(0.5);
    td.processAudio(0.5);
    const e = td.processAudio(0.01);
    expect(e?.type).toBe("utterance");
  });

  it("should process transcript for semantic EOT", () => {
    const td = createTurnDetector();
    const decision = td.processTranscript("hello world");
    expect(["continue", "turn_complete", "awaiting_input"]).toContain(decision);
  });

  it("should return config", () => {
    const td = createTurnDetector();
    const cfg = td.getConfig();
    expect(cfg.vad.energyThreshold).toBe(0.02);
    expect(cfg.semantic.enabled).toBe(true);
  });

  it("should update config", () => {
    const td = createTurnDetector();
    td.updateConfig({ vad: { energyThreshold: 0.05, silenceTimeoutMs: 1500, minSpeechDurationMs: 100, minSilenceDurationMs: 300, debounceMs: 200 } });
    expect(td.getConfig().vad.energyThreshold).toBe(0.05);
  });

  it("should track false cut rate", () => {
    const td = createTurnDetector();
    expect(td.getFalseCutRate()).toBe(0);
    td.processAudio(0.5);
    td.processAudio(0.01);
    td.processTranscript("test");
    expect(td.getFalseCutRate()).toBeGreaterThan(0);
  });

  it("uses hybrid silero scorer when provided", () => {
    const td = createTurnDetector(
      { vadBackend: "hybrid", vad: { energyThreshold: 0.9, silenceTimeoutMs: 1500, minSpeechDurationMs: 0, minSilenceDurationMs: 0, debounceMs: 5 } },
      { scoreSpeech: () => 0.9 },
    );
    const event = td.processAudio(0.01);
    expect(event?.type).toBe("speech_start");
  });
});
