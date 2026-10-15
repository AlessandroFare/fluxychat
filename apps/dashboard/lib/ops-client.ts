import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface OpsChatResult {
  session: { id: string };
  reply: string;
  panel: { summary: string; mermaid: string; assumptions: string[] } | null;
  drafted: {
    ok?: boolean;
    missing?: string[];
    questions?: string[];
    lint?: { ok: boolean; errors?: Array<{ code: string; message: string }> };
    version?: { id: string; status: string };
    definition?: { title?: string; steps?: Array<{ id: string; type: string }> };
  };
}

export async function opsBuilderChat(token: string, text: string, sessionId?: string) {
  return fetchWorkerJson<OpsChatResult>(`${BASE}/ops/builder/sessions`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ text, sessionId }),
  });
}

export async function opsPublishRequest(token: string, versionId: string) {
  return fetchWorkerJson<{ ok?: boolean; approvalId?: string; error?: string }>(
    `${BASE}/ops/builder/publish-request`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ versionId }),
    },
  );
}

export async function opsListApprovals(token: string) {
  return fetchWorkerJson<{
    items: Array<{ id: string; stepId?: string; runId?: string; payloadHash?: string; payload?: { versionId?: string } }>;
  }>(`${BASE}/ops/approvals`, { headers: authHeaders(token) });
}

export async function opsGetPolicy(token: string) {
  return fetchWorkerJson<{
    policy: { guestDomains?: string[]; highRiskQuorum?: number; allowedViews?: string[] };
    namedViews?: Array<{ name: string; description?: string; columns?: string[]; synonyms?: string[] }>;
  }>(`${BASE}/ops/policy`, {
    headers: authHeaders(token),
  });
}

export async function opsPutPolicy(token: string, policy: Record<string, unknown>) {
  return fetchWorkerJson(`${BASE}/ops/policy`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ policy }),
  });
}

export async function opsInviteGuest(token: string, body: { runId: string; email: string; can?: string[] }) {
  return fetchWorkerJson<{ token?: string; error?: string }>(`${BASE}/ops/guests/invite`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function opsDecideApproval(
  token: string,
  approvalId: string,
  decision: "approve" | "deny",
  payloadHash?: string,
) {
  return fetchWorkerJson(`${BASE}/ops/approvals/${approvalId}/decide`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ decision, payloadHash }),
  });
}

export async function opsPublish(token: string, approvalId: string) {
  return fetchWorkerJson(`${BASE}/ops/builder/publish`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ approvalId }),
  });
}

export async function opsStartRun(token: string, body: { versionId?: string; slug?: string; context?: Record<string, unknown> }) {
  return fetchWorkerJson<{ run: { id: string; status: string; roomId: string } }>(`${BASE}/ops/runs`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export interface OpsRunRow {
  id: string;
  status: string;
  roomId?: string;
  updatedAt?: string;
  killSwitch?: boolean;
}

export async function opsListRuns(token: string, status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchWorkerJson<{ runs: OpsRunRow[] }>(`${BASE}/ops/runs${q}`, {
    headers: authHeaders(token),
  });
}

export async function opsInbox(token: string) {
  return fetchWorkerJson<{ items: Array<{ id: string; runId: string; stepId: string; role?: string; dueAt?: string }> }>(
    `${BASE}/ops/inbox`,
    { headers: authHeaders(token) },
  );
}

export async function opsCompleteTask(token: string, taskId: string) {
  return fetchWorkerJson(`${BASE}/ops/tasks/${taskId}/complete`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function opsGetSources(token: string) {
  return fetchWorkerJson<{
    aiSearch: boolean;
    vectorize: boolean;
    r2: boolean;
    workersAi: boolean;
    namedViews?: Array<{ name: string }>;
  }>(`${BASE}/ops/sources`, { headers: authHeaders(token) });
}

export async function opsListTools(token: string) {
  return fetchWorkerJson<{ tools: Array<{ name: string; description: string; side: string; risk: string; enabled: boolean }> }>(
    `${BASE}/ops/tools`,
    { headers: authHeaders(token) },
  );
}

export async function opsPatchTool(token: string, name: string, enabled: boolean) {
  return fetchWorkerJson(`${BASE}/ops/tools`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ name, enabled }),
  });
}

export async function opsKillRun(token: string, runId: string) {
  return fetchWorkerJson(`${BASE}/ops/kill`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ runId }),
  });
}

export async function opsRedeemGuest(projectId: string, token: string) {
  return fetchWorkerJson<{ ok: boolean; can?: string[]; error?: string }>(`${BASE}/ops/guest/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, token }),
  });
}
