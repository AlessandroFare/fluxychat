import { describe, it, expect, vi } from "vitest";
import { createVoicePipeline, resolveVoicePipelineStages } from "./voice-pipeline";

describe("voice-pipeline", () => {
  it("should start with idle status", () => {
    const p = createVoicePipeline();
    expect(p.getStatus()).toBe("idle");
    expect(p.getMetrics()).toEqual([]);
    expect(p.getPipelineMode()).toBe("unified");
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

  it("should record metrics when processing audio (unified)", async () => {
    const p = createVoicePipeline({ pipelineMode: "unified" });
    const events: string[] = [];
    p.onEvent((e) => events.push(e.type));
    await p.start();
    await p.processAudio(new ArrayBuffer(0));
    expect(p.getMetrics().map((m) => m.stage)).toEqual(["multimodal", "speaker"]);
    expect(events).toContain("pipeline_complete");
  });

  it("should record metrics when processing text (unified)", async () => {
    const p = createVoicePipeline({ pipelineMode: "unified", preferredTransport: "text_only" });
    await p.start();
    await p.processText("hello");
    const metrics = p.getMetrics();
    expect(metrics.map((m) => m.stage)).toEqual(["multimodal", "speaker"]);
    expect(metrics.every((m) => m.pipelineMode === "unified")).toBe(true);
  });

  it("legacy mode keeps separate asr/llm/tts stages", async () => {
    const p = createVoicePipeline({ pipelineMode: "legacy", preferredTransport: "text_only" });
    await p.start();
    await p.processText("hello");
    expect(p.getMetrics().map((m) => m.stage)).toEqual(["llm", "tts", "speaker"]);
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

  it("falls back to text_only when realtime fails", async () => {
    const p = createVoicePipeline({
      preferredTransport: "realtime",
      simulateRealtimeFailure: true,
      autoFallback: true,
    });
    const events: string[] = [];
    p.onEvent((e) => events.push(e.type));
    await p.start();
    expect(p.getActiveTransport()).toBe("realtime");
    await p.processAudio(new ArrayBuffer(8));
    expect(p.getActiveTransport()).toBe("text_only");
    expect(events).toContain("transport_fallback");
    expect(events).toContain("pipeline_complete");
    expect(p.getMetrics().some((m) => m.stage === "multimodal")).toBe(true);
  });

  it("respects preferredTransport text_only in legacy mode", async () => {
    const p = createVoicePipeline({ preferredTransport: "text_only", pipelineMode: "legacy" });
    await p.start();
    expect(p.getActiveTransport()).toBe("text_only");
    await p.processAudio(new ArrayBuffer(4));
    expect(p.getMetrics().map((m) => m.stage)).toEqual(["llm", "tts", "speaker"]);
  });

  it("resolveVoicePipelineStages maps unified realtime", () => {
    expect(resolveVoicePipelineStages("unified", "realtime")).toEqual(["mic", "multimodal", "speaker"]);
    expect(resolveVoicePipelineStages("legacy", "realtime")).toEqual(["mic", "asr", "llm", "tts", "speaker"]);
  });
});
