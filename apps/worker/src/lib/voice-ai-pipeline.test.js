import { describe, it, expect } from "vitest";
import {
  listVoiceAiProviders,
  getVoiceAiProvider,
  resolveVoicePipelineMode,
  createVoiceAiSession,
} from "./voice-ai-pipeline.js";

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
    expect(p?.features).toContain("unified_multimodal");
  });

  it("resolveVoicePipelineMode defaults to unified", () => {
    expect(resolveVoicePipelineMode({})).toBe("unified");
    expect(resolveVoicePipelineMode({ pipelineMode: "legacy" })).toBe("legacy");
  });

  it("createVoiceAiSession includes pipelineMode", async () => {
    const session = await createVoiceAiSession({}, {
      projectId: "p1",
      settings: { pipelineMode: "unified" },
    });
    expect(session.pipelineMode).toBe("unified");
    expect(session.settings.pipelineMode).toBe("unified");
  });
});
