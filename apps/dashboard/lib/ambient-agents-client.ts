import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export type AmbientTriggerType = "webhook" | "message_keyword" | "room_event";
export type AmbientAutonomy = "observe" | "notify" | "act";

export interface AmbientPolicy {
  id: string;
  projectId: string;
  name: string;
  triggerType: AmbientTriggerType;
  triggerPattern: string;
  agentId: string;
  roomId: string | null;
  maxAutonomy: AmbientAutonomy;
  promptTemplate: string | null;
  enabled: boolean;
  cooldownSeconds: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AmbientPolicyRun {
  id: string;
  policyId: string;
  triggerType: string;
  triggerPayload: Record<string, unknown>;
  roomId: string | null;
  agentId: string;
  status: string;
  autonomyLevel: string;
  runId: string | null;
  messageId: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export async function listAmbientPolicies(token: string) {
  return fetchWorkerJson<{ ok: boolean; policies: AmbientPolicy[] }>(
    `${BASE}/admin/ambient/policies`,
    { headers: authHeaders(token) },
  );
}

export async function createAmbientPolicy(
  token: string,
  body: {
    name: string;
    triggerType: AmbientTriggerType;
    triggerPattern: string;
    agentId: string;
    roomId?: string;
    maxAutonomy?: AmbientAutonomy;
    promptTemplate?: string;
    cooldownSeconds?: number;
  },
) {
  return fetchWorkerJson<{ ok: boolean; policy: AmbientPolicy }>(
    `${BASE}/admin/ambient/policies`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) },
  );
}

export async function deleteAmbientPolicy(token: string, policyId: string) {
  return fetchWorkerJson<{ ok: boolean }>(
    `${BASE}/admin/ambient/policies/${encodeURIComponent(policyId)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
}

export async function triggerAmbientPolicy(
  token: string,
  policyId: string,
  body: { roomId?: string; triggerKey?: string; payload?: Record<string, unknown> },
) {
  return fetchWorkerJson<{ ok: boolean; runId?: string; status?: string }>(
    `${BASE}/admin/ambient/policies/${encodeURIComponent(policyId)}/trigger`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) },
  );
}

export async function dispatchAmbientEvent(
  token: string,
  body: {
    triggerType: AmbientTriggerType;
    triggerKey: string;
    roomId?: string;
    payload?: Record<string, unknown>;
  },
) {
  return fetchWorkerJson<{ ok: boolean; matched: number; results: unknown[] }>(
    `${BASE}/admin/ambient/dispatch`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) },
  );
}

export async function listAmbientPolicyRuns(token: string, policyId?: string) {
  const url = new URL(`${BASE}/admin/ambient/runs`);
  if (policyId) url.searchParams.set("policyId", policyId);
  return fetchWorkerJson<{ ok: boolean; runs: AmbientPolicyRun[] }>(url.toString(), {
    headers: authHeaders(token),
  });
}
