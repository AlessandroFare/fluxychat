export const VOICE_BRIDGE_SOURCES = ["livekit-agents", "pipecat", "openai-realtime"] as const;
export const VOICE_BRIDGE_KINDS = [
  "transcript",
  "tool_call",
  "approval_request",
  "coach_whisper",
  "handoff",
] as const;

export type VoiceBridgeSource = (typeof VOICE_BRIDGE_SOURCES)[number];
export type VoiceBridgeKind = (typeof VOICE_BRIDGE_KINDS)[number];

export interface VoiceBridgeEventInput {
  source: VoiceBridgeSource;
  kind?: VoiceBridgeKind;
  participantType?: "human" | "ai";
  text?: string;
  transcript?: string;
  toolName?: string;
  approvalId?: string;
  visibleToUserId?: string;
  callId?: string;
}

export interface VoiceBridgeEvent {
  type: "voice_bridge";
  source: VoiceBridgeSource;
  kind: VoiceBridgeKind;
  participantType: "human" | "ai";
  text: string;
  toolName: string | null;
  approvalId: string | null;
  visibleToUserId: string | null;
  callId: string | null;
}

export function mapVoiceBridgeEvent(body: VoiceBridgeEventInput): VoiceBridgeEvent {
  const source = body.source;
  if (!VOICE_BRIDGE_SOURCES.includes(source)) {
    throw new Error("unknown_source");
  }
  const kind = body.kind ?? "transcript";
  if (!VOICE_BRIDGE_KINDS.includes(kind)) throw new Error("unknown_kind");
  const text = String(body.text || body.transcript || "").trim();
  if (!text && kind !== "handoff") throw new Error("text_required");
  return {
    type: "voice_bridge",
    source,
    kind,
    participantType: body.participantType === "human" ? "human" : "ai",
    text,
    toolName: body.toolName ?? null,
    approvalId: body.approvalId ?? null,
    visibleToUserId: body.visibleToUserId ?? null,
    callId: body.callId ?? null,
  };
}

/** POST /rooms/:id/voice-bridge — transcripts and HITL, not RTP. */
export async function postVoiceBridgeEvent(opts: {
  workerUrl: string;
  token: string;
  roomId: string;
  event: VoiceBridgeEventInput;
}): Promise<{ ok: boolean; status: number }> {
  const event = mapVoiceBridgeEvent(opts.event);
  const res = await fetch(`${opts.workerUrl.replace(/\/$/, "")}/rooms/${encodeURIComponent(opts.roomId)}/voice-bridge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  return { ok: res.ok, status: res.status };
}
