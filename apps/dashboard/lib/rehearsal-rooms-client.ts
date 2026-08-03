import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface RehearsalRoom {
  rehearsalId: string;
  projectId: string;
  sourceRoomId: string;
  rehearsalRoomId: string;
  ownerUserId: string;
  agentId: string | null;
  snapshotTs: string;
  statedGoal: string | null;
  counterpartyRole: string | null;
  snapshotMessageCount: number;
  ttlSeconds: number;
  expiresAt: string;
  persistAfterSession: boolean;
  status: string;
  createdAt: string;
  disclaimer: string;
}

export async function listRehearsals(token: string, opts?: { sourceRoomId?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.sourceRoomId) params.set("sourceRoomId", opts.sourceRoomId);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return fetchWorkerJson<{ ok: boolean; rehearsals: RehearsalRoom[] }>(
    `${BASE}/rehearsals${qs ? `?${qs}` : ""}`,
    { headers: authHeaders(token) },
  );
}

export async function getRehearsal(token: string, rehearsalId: string) {
  return fetchWorkerJson<{ ok: boolean; rehearsal: RehearsalRoom }>(
    `${BASE}/rehearsals/${encodeURIComponent(rehearsalId)}`,
    { headers: authHeaders(token) },
  );
}

export async function createRehearsal(
  token: string,
  sourceRoomId: string,
  body: {
    statedGoal?: string;
    counterpartyRole?: string;
    agentId?: string;
    ttlSeconds?: number;
    persistAfterSession?: boolean;
  },
) {
  return fetchWorkerJson<{ ok: boolean; rehearsal: RehearsalRoom }>(
    `${BASE}/rooms/${encodeURIComponent(sourceRoomId)}/rehearsal`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    },
  );
}

export async function deleteRehearsal(token: string, rehearsalId: string) {
  return fetchWorkerJson<{ ok: boolean; rehearsalId?: string }>(
    `${BASE}/rehearsals/${encodeURIComponent(rehearsalId)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
}
