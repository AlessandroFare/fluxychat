import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export type TelephonyChannel = "voice" | "sms" | "whatsapp";

export interface TelephonyHandoffRequest {
  roomId: string;
  fromE164?: string;
  channel?: TelephonyChannel;
  providerId?: string;
  reason?: string;
  requestVoiceSession?: boolean;
}

export interface TelephonyHandoffResult {
  ok: boolean;
  error?: string;
  handoff?: {
    active?: boolean;
    handedOffByUserId?: string;
    contextSummary?: string;
  };
  voiceSession?: {
    sessionId?: string;
    wsUrl?: string;
    error?: string;
  } | null;
  suggestedAgentUserId?: string | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function triggerTelephonyHandoff(
  token: string,
  input: TelephonyHandoffRequest,
): Promise<TelephonyHandoffResult> {
  return fetchWorkerJson<TelephonyHandoffResult>(`${BASE}/integrations/telephony/handoff`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}
