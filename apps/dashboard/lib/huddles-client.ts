import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface CallSession {
  id: string;
  project_id: string;
  room_id: string;
  provider: string;
  status: string;
  recording_enabled: number;
  started_at: string | null;
  ended_at: string | null;
}

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  display_name: string | null;
  role: string;
  audio_enabled: number;
  video_enabled: number;
  screen_sharing: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listActiveCalls(token: string): Promise<{ calls: CallSession[] }> {
  return fetchWorkerJson(`${BASE}/admin/calls/active`, { headers: authHeaders(token) });
}

export async function createCall(
  token: string,
  body: { roomId: string; provider?: string; recordingEnabled?: boolean; maxParticipants?: number },
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/admin/calls`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getCall(
  token: string,
  callId: string,
): Promise<{ call: CallSession; participants: CallParticipant[] }> {
  return fetchWorkerJson(`${BASE}/admin/calls/${encodeURIComponent(callId)}`, { headers: authHeaders(token) });
}

export async function startCall(token: string, callId: string): Promise<unknown> {
  return fetchWorkerJson(`${BASE}/admin/calls/${encodeURIComponent(callId)}/start`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function endCall(token: string, callId: string): Promise<unknown> {
  return fetchWorkerJson(`${BASE}/admin/calls/${encodeURIComponent(callId)}/end`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function joinCall(
  token: string,
  body: { callId: string; displayName?: string; role?: string },
): Promise<unknown> {
  return fetchWorkerJson(`${BASE}/admin/calls/join`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function toggleCallRecording(
  token: string,
  callId: string,
  enabled: boolean,
): Promise<unknown> {
  return fetchWorkerJson(`${BASE}/admin/calls/${encodeURIComponent(callId)}/recording`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

export async function getCallStats(token: string): Promise<{ stats: Record<string, unknown> }> {
  return fetchWorkerJson(`${BASE}/admin/calls/stats`, { headers: authHeaders(token) });
}

export async function getCallToken(
  token: string,
  body: { roomId: string; provider?: string; displayName?: string },
): Promise<{ token: string }> {
  return fetchWorkerJson(`${BASE}/admin/calls/token`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
