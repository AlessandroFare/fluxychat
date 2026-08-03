import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface DebateRole {
  id: string;
  projectId: string;
  triggerPattern: string | null;
  roleName: string;
  systemPrompt: string;
  maxRounds: number;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DebateSession {
  id: string;
  projectId: string;
  roomId: string;
  prompt: string;
  status: string;
  maxRounds: number;
  currentRound: number;
  steps: Array<Record<string, unknown>>;
  synthesisContent: string | null;
  latencyMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

export async function listDebateRoles(token: string) {
  return fetchWorkerJson<{ ok: boolean; roles: DebateRole[] }>(
    `${BASE}/admin/agent-debate/roles`,
    { headers: authHeaders(token) },
  );
}

export async function seedDebateRoles(token: string) {
  return fetchWorkerJson<{ ok: boolean; seeded: number; roles: DebateRole[] }>(
    `${BASE}/admin/agent-debate/roles/seed`,
    { method: "POST", headers: authHeaders(token) },
  );
}

export async function createDebateRole(
  token: string,
  body: { roleName: string; systemPrompt: string; sortOrder?: number; maxRounds?: number },
) {
  return fetchWorkerJson<{ ok: boolean; role: DebateRole }>(
    `${BASE}/admin/agent-debate/roles`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) },
  );
}

export async function deleteDebateRole(token: string, roleId: string) {
  return fetchWorkerJson<{ ok: boolean }>(
    `${BASE}/admin/agent-debate/roles/${encodeURIComponent(roleId)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
}

export async function runAgentDebate(
  token: string,
  body: { roomId: string; prompt: string; maxRounds?: number; roleIds?: string[] },
) {
  return fetchWorkerJson<{ ok: boolean; session: DebateSession; timedOut?: boolean }>(
    `${BASE}/admin/agent-debate/run`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) },
  );
}

export async function listDebateSessions(token: string, roomId: string) {
  const url = new URL(`${BASE}/admin/agent-debate/sessions`);
  url.searchParams.set("roomId", roomId);
  return fetchWorkerJson<{ ok: boolean; sessions: DebateSession[] }>(url.toString(), {
    headers: authHeaders(token),
  });
}
