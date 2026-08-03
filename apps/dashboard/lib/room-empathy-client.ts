import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface RoomEmpathySettings {
  enabled: boolean;
  minConfidence: number;
  escalateOnStressed: boolean;
  updatedAt: string | null;
}

export interface ProsodySignalPayload {
  turnId?: string;
  pitchVariance: number;
  speechRate: number;
  pauseRatio: number;
  inferredState: "calm" | "frustrated" | "stressed" | "neutral";
  confidence: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function getRoomEmpathySettings(
  token: string,
  roomId: string,
): Promise<{ ok: boolean; settings: RoomEmpathySettings }> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/empathy/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateRoomEmpathySettings(
  token: string,
  roomId: string,
  patch: Partial<{ enabled: boolean; minConfidence: number; escalateOnStressed: boolean }>,
): Promise<{ ok: boolean; settings: RoomEmpathySettings }> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/empathy/settings`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
}

export async function postProsodySignal(
  token: string,
  roomId: string,
  signal: ProsodySignalPayload,
): Promise<{ ok: boolean; accepted?: boolean; signal?: ProsodySignalPayload }> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/empathy/signal`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(signal),
  });
}
