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

export interface OpsApprovalRow {
  id: string;
  stepId?: string;
  runId?: string;
  payloadHash?: string;
  required?: number;
  decisions?: unknown[];
  createdAt?: string;
  payload?: { tool?: string; input?: Record<string, unknown>; versionId?: string };
}

export async function opsListApprovals(token: string) {
  return fetchWorkerJson<{ items: OpsApprovalRow[] }>(`${BASE}/ops/approvals`, { headers: authHeaders(token) });
}

export async function opsGetPolicy(token: string) {
  return fetchWorkerJson<{
    policy: {
      guestDomains?: string[];
      highRiskQuorum?: number;
      allowedViews?: string[];
      incidentWorkflowSlug?: string | null;
      incidentWorkflowSlugs?: {
        created?: string | null;
        acknowledged?: string | null;
        resolved?: string | null;
      };
    };
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
  cost?: { toolCalls?: number; tokens?: number; maxToolCalls?: number };
}

export async function opsListRuns(token: string, status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchWorkerJson<{ runs: OpsRunRow[] }>(`${BASE}/ops/runs${q}`, {
    headers: authHeaders(token),
  });
}

export interface OpsToolCallRow {
  id: string;
  runId?: string;
  actor?: string;
  eventType: string;
  inputHash?: string;
  createdAt?: string;
  result?: { tool?: string; error?: string; payloadHash?: string; mocked?: boolean };
}

export async function opsToolCalls(token: string, runId?: string) {
  const q = runId ? `?runId=${encodeURIComponent(runId)}` : "";
  return fetchWorkerJson<{ items: OpsToolCallRow[] }>(`${BASE}/ops/tool-calls${q}`, {
    headers: authHeaders(token),
  });
}

export interface OpsOversight {
  from: string | null;
  to: string | null;
  fastSeconds: number;
  requested: number;
  pending: number;
  decided: number;
  approved: number;
  denied: number;
  medianDecisionSeconds: number | null;
  fastDecisions: number;
  fastShare: number | null;
  quorumRequested: number;
  quorumMet: number;
  quorumRate: number | null;
  distinctApprovers: number;
  toolDenials: number;
  rubberStamp: boolean;
}

/** Oversight health over a window of days; also embedded in the evidence pack. */
export async function opsOversight(token: string, days = 30) {
  return fetchWorkerJson<OpsOversight>(`${BASE}/ops/oversight?days=${encodeURIComponent(days)}`, {
    headers: authHeaders(token),
  });
}

export interface OpsInputRequest {
  runId: string;
  roomId: string | null;
  stepId: string;
  tool: string;
  server: string | null;
  message: string;
  requestId: string | null;
  requestedSchema?: {
    type?: string;
    properties?: Record<string, { type?: string; description?: string; title?: string }>;
    required?: string[];
  } | null;
  askedAt: string | null;
}

/** MRTR: upstream MCP tools waiting for a human answer before the run resumes. */
export async function opsInputRequests(token: string) {
  return fetchWorkerJson<{ items: OpsInputRequest[] }>(`${BASE}/ops/inputs`, {
    headers: authHeaders(token),
  });
}

export async function opsAnswerRunInput(
  token: string,
  runId: string,
  responses: Array<{ id: string; content: Record<string, string> }>,
) {
  return fetchWorkerJson<{ ok: boolean; run?: OpsRunRow }>(`${BASE}/ops/runs/${encodeURIComponent(runId)}/input`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ responses }),
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

export interface OpsMcpServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  /** "oauth"/"enterprise" servers use each run actor's own connection; "secret" a shared bearer. */
  auth?: "secret" | "oauth" | "enterprise";
  hasSecret: boolean;
  hasOauthClientSecret?: boolean;
  hasEnterpriseResourceClientSecret?: boolean;
  oauthClientId?: string | null;
  oauthAuthorizeUrl?: string | null;
  oauthTokenUrl?: string | null;
  oauthScopes?: string | null;
  allowedTools: string[];
  discoveredTools: string[];
  /** Pinned tool definitions; `changed` means calls are blocked until re-approval. */
  toolsCatalog?: OpsMcpToolInfo[];
  createdAt?: string;
  updatedAt?: string;
}

export interface OpsMcpConnection {
  id: string;
  serverId: string;
  serverName?: string | null;
  status: string;
  scopes?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpsMcpToolInfo {
  name: string;
  description?: string;
  readOnly?: boolean;
  /** True when the upstream definition no longer matches the approved hash. */
  changed?: boolean;
  approvedAt?: string | null;
  /** Pinned input schema (allow-listed tools only); seeds the Try form. */
  inputSchema?: Record<string, unknown> | null;
}

export interface OpsMcpDiscovery {
  ok: boolean;
  error?: string;
  message?: string | null;
  tools?: string[];
  catalog?: OpsMcpToolInfo[];
}

export interface OpsMcpRegistration {
  ok: boolean;
  error?: string;
  server?: OpsMcpServer;
  discovery?: OpsMcpDiscovery;
}

export async function opsListMcpServers(token: string) {
  return fetchWorkerJson<{ servers: OpsMcpServer[] }>(`${BASE}/ops/mcp-servers`, {
    headers: authHeaders(token),
  });
}

export async function opsRegisterMcpServer(
  token: string,
  body: {
    name: string;
    url: string;
    secret?: string;
    allowedTools?: string[];
    enabled?: boolean;
    auth?: "secret" | "oauth";
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthAuthorizeUrl?: string;
    oauthTokenUrl?: string;
    oauthScopes?: string;
  },
) {
  return fetchWorkerJson<OpsMcpRegistration>(`${BASE}/ops/mcp-servers`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function opsRefreshMcpServer(token: string, id: string) {
  return fetchWorkerJson<OpsMcpRegistration>(`${BASE}/ops/mcp-servers/${encodeURIComponent(id)}/refresh`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

/** Re-pins one tool definition after a drift block; admin only. */
export async function opsReapproveMcpTool(token: string, id: string, tool: string) {
  return fetchWorkerJson<{ ok: boolean; error?: string; server?: OpsMcpServer }>(
    `${BASE}/ops/mcp-servers/${encodeURIComponent(id)}/tools/${encodeURIComponent(tool)}/reapprove`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify({}) },
  );
}

/** Calls one pinned read-only tool from the settings card; writes need a run approval. */
export async function opsTryMcpTool(token: string, id: string, tool: string, args: Record<string, unknown>) {
  return fetchWorkerJson<{
    ok: boolean;
    error?: string;
    message?: string;
    server?: string;
    tool?: string;
    content?: unknown;
    structuredContent?: unknown;
  }>(`${BASE}/ops/mcp-servers/${encodeURIComponent(id)}/tools/${encodeURIComponent(tool)}/try`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ arguments: args }),
  });
}

export async function opsDeleteMcpServer(token: string, id: string) {
  return fetchWorkerJson<{ ok: boolean }>(`${BASE}/ops/mcp-servers/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

/** Starts a per-user OAuth connect; open the returned URL to finish at the provider. */
export async function opsConnectMcpServer(token: string, id: string) {
  return fetchWorkerJson<{ ok: boolean; error?: string; message?: string; authorizationUrl?: string }>(
    `${BASE}/ops/mcp-servers/${encodeURIComponent(id)}/connect`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify({}) },
  );
}

export async function opsListMcpConnections(token: string) {
  return fetchWorkerJson<{ items: OpsMcpConnection[] }>(`${BASE}/ops/mcp-connections`, {
    headers: authHeaders(token),
  });
}

export async function opsDisconnectMcpConnection(token: string, id: string) {
  return fetchWorkerJson<{ ok: boolean }>(`${BASE}/ops/mcp-connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
