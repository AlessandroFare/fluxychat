import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface DecisionRoomFeature {
  id: string;
  label: string;
  path: string;
  description: string;
}

export interface DecisionRoomPackPreview {
  packId: string;
  name: string;
  roomType: string;
  features: DecisionRoomFeature[];
  templates: Array<{ name: string; body: string }>;
  welcomeMessage: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function fetchDecisionRoomPackPreview(token?: string) {
  return fetchWorkerJson<{ ok: boolean; pack: DecisionRoomPackPreview }>(
    `${BASE}/packs/decision-rooms`,
    token ? { headers: authHeaders(token) } : undefined,
  );
}

export async function provisionDecisionRoomPack(token: string, name: string) {
  return fetchWorkerJson<{
    ok: boolean;
    packId: string;
    room: { id: string; name: string; type: string; created_at?: string };
    templatesCreated: number;
    features: DecisionRoomFeature[];
  }>(`${BASE}/packs/decision-rooms`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
}
