import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface VoiceStageConfig {
  id: string;
  projectId: string;
  roomId: string;
  enabled: boolean;
  maxSpeakers: number;
  createdAt: string;
  updatedAt: string;
}

export async function getVoiceStageConfig(token: string, roomId: string) {
  return fetchWorkerJson<{ ok: boolean; config: VoiceStageConfig | null }>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/stage`,
    { headers: authHeaders(token) },
  );
}

export async function enableVoiceStage(
  token: string,
  roomId: string,
  body?: { maxSpeakers?: number },
) {
  return fetchWorkerJson<{ ok: boolean; config: VoiceStageConfig }>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/stage`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ enabled: true, ...body }),
    },
  );
}
