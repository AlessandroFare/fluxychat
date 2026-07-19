import { describe, it, expect, vi } from "vitest";
import { createVoicePipeline } from "./voice-pipeline";

describe("voice-pipeline", () => {
  it("should start with idle status", () => {
    const p = createVoicePipeline();
    expect(p.getStatus()).toBe("idle");
    expect(p.getMetrics()).toEqual([]);
  });

  it("should transition to running on start", async () => {
    const p = createVoicePipeline();
    await p.start();
    expect(p.getStatus()).toBe("running");
  });

  it("should transition to paused on pause", async () => {
    const p = createVoicePipeline();
    await p.start();
    await p.pause();
    expect(p.getStatus()).toBe("paused");
  });

  it("should resume from paused", async () => {
    const p = createVoicePipeline();
    await p.start();
    await p.pause();
    await p.resume();
    expect(p.getStatus()).toBe("running");
  });

  it("should record metrics when processing audio", async () => {
    const p = createVoicePipeline();
    const events: string[] = [];
    p.onEvent((e) => events.push(e.type));
    await p.start();
    await p.processAudio(new ArrayBuffer(0));
    expect(p.getMetrics().length).toBeGreaterThan(0);
    expect(events).toContain("stage_start");
    expect(events).toContain("stage_end");
    expect(events).toContain("pipeline_complete");
  });

  it("should record metrics when processing text", async () => {
    const p = createVoicePipeline();
    await p.start();
    await p.processText("hello");
    const metrics = p.getMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((m) => m.durationMs >= 0)).toBe(true);
  });

  it("should not process when not running", async () => {
    const p = createVoicePipeline();
    await p.processAudio(new ArrayBuffer(0));
    expect(p.getMetrics()).toEqual([]);
  });

  it("should report total latency", async () => {
    const p = createVoicePipeline();
    await p.start();
    await p.processText("test");
    expect(p.getLatencyMs()).toBeGreaterThanOrEqual(0);
  });

  it("should support multiple event listeners", async () => {
    const p = createVoicePipeline();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    p.onEvent(fn1);
    p.onEvent(fn2);
    await p.start();
    await p.processText("test");
    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });
});
