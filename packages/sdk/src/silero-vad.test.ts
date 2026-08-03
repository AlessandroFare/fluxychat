import { describe, it, expect } from "vitest";
import { createSileroVadScorer, audioLevelFromPcmBuffer, scorePcmFrame } from "./silero-vad";

describe("silero-vad", () => {
  it("maps silence to low speech probability", () => {
    const scorer = createSileroVadScorer();
    expect(scorer.scoreSpeech(0.001)).toBeLessThan(0.2);
  });

  it("maps loud signal to high speech probability", () => {
    const scorer = createSileroVadScorer({ energyGain: 20 });
    expect(scorer.scoreSpeech(0.15)).toBeGreaterThan(0.5);
  });

  it("computes RMS from PCM buffer", () => {
    const buf = new ArrayBuffer(4);
    const view = new Int16Array(buf);
    view[0] = 16000;
    view[1] = -16000;
    expect(audioLevelFromPcmBuffer(buf)).toBeGreaterThan(0.4);
  });

  it("scorePcmBuffer uses frame VAD by default", () => {
    const scorer = createSileroVadScorer();
    const buf = new ArrayBuffer(1024);
    const view = new Int16Array(buf);
    for (let i = 0; i < view.length; i++) view[i] = i % 2 === 0 ? 8000 : -8000;
    expect(scorer.scorePcmBuffer(buf)).toBeGreaterThan(0.3);
    expect(scorer.mode).toBe("frame");
  });

  it("scorePcmFrame detects speech-like frames", () => {
    const view = new Int16Array(512);
    for (let i = 0; i < view.length; i++) view[i] = Math.sin(i / 8) * 12000;
    expect(scorePcmFrame(view, { noiseFloor: 0.005 })).toBeGreaterThan(0.4);
  });

  it("loadOnnx falls back to frame mode in node", async () => {
    const scorer = createSileroVadScorer();
    const loaded = await scorer.loadOnnx();
    expect(loaded).toBe(false);
    expect(scorer.mode).toBe("frame");
  });
});
