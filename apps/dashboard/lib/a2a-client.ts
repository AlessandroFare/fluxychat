import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface A2AAgentCard {
  id: string;
  agentId: string;
  name: string;
  description?: string | null;
  capabilities: unknown[];
  endpointUrl?: string | null;
  healthUrl?: string | null;
  status: string;
}

export interface A2ATask {
  id: string;
  title: string;
  status: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  sourceAgentId?: string | null;
  targetAgentId?: string | null;
  createdAt: string;
}

export async function listA2AAgentCards(token: string) {
  return fetchWorkerJson<{ ok: boolean; cards: A2AAgentCard[] }>(`${BASE}/a2a/agent-cards`, {
    headers: authHeaders(token),
  });
}

export async function registerA2AAgentCard(
  token: string,
  body: {
    agentId: string;
    name: string;
    description?: string;
    capabilities?: unknown[];
    endpointUrl?: string;
    healthUrl?: string;
  },
) {
  return fetchWorkerJson<{ ok: boolean; card: A2AAgentCard }>(`${BASE}/admin/a2a/agent-cards`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function checkA2AAgentHealth(token: string, agentId: string) {
  return fetchWorkerJson<{ ok: boolean; health: { ok: boolean; status?: number; error?: string } }>(
    `${BASE}/a2a/agent-cards/${encodeURIComponent(agentId)}/health`,
    { headers: authHeaders(token) },
  );
}

export async function listA2ATasks(token: string) {
  return fetchWorkerJson<{ ok: boolean; tasks: A2ATask[] }>(`${BASE}/a2a/tasks`, {
    headers: authHeaders(token),
  });
}

export async function createA2ATask(
  token: string,
  body: { title: string; input?: Record<string, unknown>; targetAgentId?: string },
) {
  return fetchWorkerJson<{ ok: boolean; task: A2ATask }>(`${BASE}/a2a/tasks`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function sendA2AEnvelope(
  token: string,
  body: { sourceAgentId: string; targetAgentId: string; taskId: string; status?: string },
) {
  return fetchWorkerJson(`${BASE}/a2a/envelopes`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function receiveA2AEnvelopes(token: string, agentId: string) {
  return fetchWorkerJson<{ ok: boolean; envelopes: Array<{ id: string; source: string; taskId: string }> }>(
    `${BASE}/a2a/envelopes/receive?agentId=${encodeURIComponent(agentId)}`,
    { headers: authHeaders(token) },
  );
}
