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

export interface SfuProxyResult<T> {
  ok?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function unwrapSfuResult<T>(body: SfuProxyResult<T> & Partial<T>): T {
  if (body?.ok === false) {
    throw new Error(body.message || body.error || "sfu_upstream");
  }
  if (body?.ok === true && body.data) return body.data;
  return body as T;
}

export interface SfuSessionCreated {
  sessionId: string;
  sessionDescription?: RTCSessionDescriptionInit;
}

export interface SfuTracksResult {
  requiresImmediateRenegotiation?: boolean;
  sessionDescription?: RTCSessionDescriptionInit;
  tracks?: Array<{ trackName?: string; mid?: string; errorCode?: string; errorDescription?: string }>;
}

export interface HuddleRoomTrack {
  user_id: string;
  session_id: string;
  track_name: string;
  kind: string;
}

export async function createRealtimeSession(
  token: string,
  roomId: string,
  sessionDescription: RTCSessionDescriptionInit,
): Promise<SfuSessionCreated> {
  const body = await fetchWorkerJson<SfuProxyResult<SfuSessionCreated>>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/realtime/sessions`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ sessionDescription }),
    },
  );
  return unwrapSfuResult(body);
}

export async function addRealtimeTracks(
  token: string,
  roomId: string,
  sessionId: string,
  payload: { sessionDescription?: RTCSessionDescriptionInit; tracks: unknown[] },
): Promise<SfuTracksResult> {
  const body = await fetchWorkerJson<SfuProxyResult<SfuTracksResult>>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/realtime/sessions/${encodeURIComponent(sessionId)}/tracks`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const data = unwrapSfuResult(body);
  const failed = (data.tracks || []).find((t) => t.errorCode);
  if (failed) throw new Error(failed.errorDescription || failed.errorCode || "track_error");
  return data;
}

export async function renegotiateRealtimeSession(
  token: string,
  roomId: string,
  sessionId: string,
  sessionDescription: RTCSessionDescriptionInit,
): Promise<unknown> {
  const body = await fetchWorkerJson<SfuProxyResult<unknown>>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/realtime/sessions/${encodeURIComponent(sessionId)}/renegotiate`,
    {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ sessionDescription }),
    },
  );
  return unwrapSfuResult(body);
}

export async function announceHuddleTracks(
  token: string,
  roomId: string,
  body: { sessionId: string; tracks: Array<{ trackName: string; kind: string }> },
): Promise<void> {
  await fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/realtime/tracks`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listHuddleRoomTracks(
  token: string,
  roomId: string,
): Promise<{ tracks: HuddleRoomTrack[] }> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/realtime/tracks`, {
    headers: authHeaders(token),
  });
}

export async function leaveHuddleRoomTracks(token: string, roomId: string): Promise<void> {
  await fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/realtime/tracks`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export interface HuddleSfuBudget {
  estimated: boolean;
  month: string;
  bytesUsed: number;
  capBytes: number;
  remainingBytes: number;
  openSessions: number;
  maxConcurrent: number;
  maxSessionSeconds: number;
  allowVideo: boolean;
  disabled: boolean;
  monthlyGbCap: number;
}

export async function getHuddleSfuBudget(token: string, roomId: string): Promise<HuddleSfuBudget> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/realtime/budget`, {
    headers: authHeaders(token),
  });
}
