/**
 * NW-130 — Telephony → agent handoff (Telnyx/Twilio inbound → voice AI + support routing).
 */
import { createVoiceAiSession } from "./voice-ai-pipeline.js";
import { requestHumanHandoff } from "./room-handoff.js";
import { loadRoomRoutingCandidates, pickBestSupportAgent } from "./support-routing.js";
import { logInfo } from "./worker-log.js";

function isTelephonyHandoffEnabled(env) {
  return (
    env.TELEPHONY_AGENT_HANDOFF === "true" ||
    env.TELEPHONY_AGENT_HANDOFF === "1" ||
    env.TELCO_AGENT_HANDOFF === "true"
  );
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   fromE164?: string,
 *   channel?: string,
 *   providerId?: string,
 *   reason?: string,
 *   requestVoiceSession?: boolean,
 * }} input
 */
export async function handleTelephonyAgentHandoff(env, input) {
  const projectId = String(input.projectId || "").trim();
  const roomId = String(input.roomId || "").trim();
  const userId = String(input.userId || "").trim();
  if (!projectId || !roomId || !userId) {
    return { ok: false, error: "missing_fields" };
  }

  const handoff = await requestHumanHandoff(env, {
    projectId,
    roomId,
    userId,
    reason:
      input.reason ||
      `Telephony handoff from ${input.fromE164 || "unknown"} (${input.channel || "sms"})`,
    triggerSource: "telephony",
  });

  let voiceSession = null;
  if (input.requestVoiceSession !== false) {
    voiceSession = await createVoiceAiSession(env, {
      projectId,
      providerId: input.providerId || "openai-realtime",
      roomId,
      userId,
      settings: { pipelineMode: "unified", bargeIn: true },
    });
    if (voiceSession.error) voiceSession = null;
  }

  let suggestedAgent = null;
  try {
    const candidates = await loadRoomRoutingCandidates(env, { projectId, roomId });
    suggestedAgent = pickBestSupportAgent(candidates, {
      requiredSkills: input.channel === "voice" ? ["voice", "support"] : ["support"],
    });
  } catch {
    suggestedAgent = null;
  }

  logInfo("telephony.handoff", {
    projectId,
    roomId,
    userId,
    handoffActive: handoff.handoff?.active,
    voiceSessionId: voiceSession?.sessionId ?? null,
    suggestedAgent: suggestedAgent?.userId ?? null,
  });

  return {
    ok: true,
    handoff: handoff.handoff ?? handoff,
    voiceSession,
    suggestedAgentUserId: suggestedAgent?.userId ?? null,
  };
}

/**
 * Auto-handoff hook for telco inbound when enabled.
 */
export async function maybeTelephonyHandoffOnInbound(env, detail) {
  if (!isTelephonyHandoffEnabled(env)) {
    return { skipped: true, reason: "disabled" };
  }
  if (!detail?.projectId || !detail?.roomId || !detail?.userId) {
    return { skipped: true, reason: "missing_context" };
  }
  return handleTelephonyAgentHandoff(env, {
    projectId: detail.projectId,
    roomId: detail.roomId,
    userId: detail.userId,
    fromE164: detail.fromE164,
    channel: detail.channel,
    requestVoiceSession: detail.channel === "voice",
  });
}

export { isTelephonyHandoffEnabled };
