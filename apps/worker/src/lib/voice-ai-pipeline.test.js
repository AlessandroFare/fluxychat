import { describe, it, expect } from "vitest";
import {
  listVoiceAiProviders,
  getVoiceAiProvider,
  resolveVoicePipelineMode,
  createVoiceAiSession,
  buildOnHoldNarration,
  applyDuplexBargeIn,
} from "./voice-ai-pipeline.js";

describe("voice-ai-pipeline", () => {
  it("lists realtime providers", () => {
    const providers = listVoiceAiProviders();
    expect(providers.length).toBeGreaterThanOrEqual(3);
    expect(providers.some((p) => p.id === "workers-ai" && p.engine === "workers-ai")).toBe(true);
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

  it("NW-200 buildOnHoldNarration + barge-in cancel", () => {
    const hold = buildOnHoldNarration({
      phrase: "Checking inventory…",
      toolName: "inventory_lookup",
      toolCallId: "tc_1",
    });
    expect(hold.type).toBe("agent_on_hold");
    expect(hold.phrase).toContain("inventory");
    expect(hold.bargeInCancels).toBe(true);
    expect(hold.targetBargeInMs).toBe(500);

    expect(
      applyDuplexBargeIn({ bargeIn: true, userSpeaking: true, onHoldActive: true }),
    ).toEqual({ cancelOnHold: true, resumeListening: true });
    expect(
      applyDuplexBargeIn({ bargeIn: true, userSpeaking: false, onHoldActive: true }),
    ).toEqual({ cancelOnHold: false, resumeListening: true });
  });
});
