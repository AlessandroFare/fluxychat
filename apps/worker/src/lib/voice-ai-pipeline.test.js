import { describe, it, expect } from "vitest";
import { listVoiceAiProviders, getVoiceAiProvider } from "./voice-ai-pipeline.js";

describe("voice-ai-pipeline", () => {
  it("lists realtime providers", () => {
    const providers = listVoiceAiProviders();
    expect(providers.length).toBeGreaterThanOrEqual(2);
    expect(providers.some((p) => p.id === "openai-realtime")).toBe(true);
    expect(providers.some((p) => p.id === "gemini-live")).toBe(true);
  });

  it("exposes latency target for openai-realtime", () => {
    const p = getVoiceAiProvider("openai-realtime");
    expect(p?.targetLatencyMs).toBe(300);
  });
});
