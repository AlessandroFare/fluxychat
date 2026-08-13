import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleTelephonyAgentHandoff,
  maybeTelephonyHandoffOnInbound,
  isTelephonyHandoffEnabled,
} from "./telephony-handoff.js";

vi.mock("./voice-ai-pipeline.js", () => ({
  createVoiceAiSession: vi.fn(async () => ({
    sessionId: "vas_test",
    provider: "openai-realtime",
    status: "ready",
  })),
}));

vi.mock("./room-handoff.js", () => ({
  requestHumanHandoff: vi.fn(async () => ({
    ok: true,
    handoff: { active: true, handoffId: "h1" },
  })),
}));

vi.mock("./support-routing.js", () => ({
  loadRoomRoutingCandidates: vi.fn(async () => [
    { userId: "agent-1", online: true, skills: ["support", "voice"] },
  ]),
  pickBestSupportAgent: vi.fn(() => ({ userId: "agent-1" })),
}));

describe("NW-130 telephony-handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isTelephonyHandoffEnabled reads env flag", () => {
    expect(isTelephonyHandoffEnabled({ TELEPHONY_AGENT_HANDOFF: "true" })).toBe(true);
    expect(isTelephonyHandoffEnabled({})).toBe(false);
  });

  it("handleTelephonyAgentHandoff creates handoff + voice session", async () => {
    const result = await handleTelephonyAgentHandoff({}, {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
      fromE164: "+15551234567",
      channel: "voice",
    });
    expect(result.ok).toBe(true);
    expect(result.handoff.active).toBe(true);
    expect(result.voiceSession?.sessionId).toBe("vas_test");
    expect(result.suggestedAgentUserId).toBe("agent-1");
  });

  it("maybeTelephonyHandoffOnInbound skips when disabled", async () => {
    const result = await maybeTelephonyHandoffOnInbound({}, {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
    });
    expect(result.skipped).toBe(true);
  });
});
