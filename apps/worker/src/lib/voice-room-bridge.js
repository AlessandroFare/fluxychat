/**
 * Voice → room bus. No SFU. LiveKit / Pipecat / OpenAI Realtime publish text here.
 */

export const VOICE_BRIDGE_SOURCES = ["livekit-agents", "pipecat", "openai-realtime"];
export const VOICE_BRIDGE_KINDS = ["transcript", "tool_call", "approval_request", "coach_whisper", "handoff"];

/**
 * @param {unknown} body
 */
export function mapVoiceBridgeEvent(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const source = String(body.source || "").trim();
  if (!VOICE_BRIDGE_SOURCES.includes(source)) return { ok: false, error: "unknown_source" };
  const kind = String(body.kind || "transcript").trim();
  if (!VOICE_BRIDGE_KINDS.includes(kind)) return { ok: false, error: "unknown_kind" };
  const participantType = body.participantType === "human" ? "human" : "ai";
  const text = String(body.text || body.transcript || "").trim();
  if (!text && kind !== "handoff") return { ok: false, error: "text_required" };
  if (text.length > 8000) return { ok: false, error: "text_too_long" };
  return {
    ok: true,
    event: {
      type: "voice_bridge",
      source,
      kind,
      participantType,
      text,
      toolName: typeof body.toolName === "string" ? body.toolName.slice(0, 128) : null,
      approvalId: typeof body.approvalId === "string" ? body.approvalId.slice(0, 64) : null,
      visibleToUserId: typeof body.visibleToUserId === "string" ? body.visibleToUserId.slice(0, 128) : null,
      callId: typeof body.callId === "string" ? body.callId.slice(0, 128) : null,
    },
  };
}
