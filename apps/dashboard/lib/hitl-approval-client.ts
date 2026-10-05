import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

export interface ApprovalChainStep {
  approverId?: string;
  timeoutSeconds?: number;
  fallback?: string;
}

export interface ApprovalChainConfig {
  steps: ApprovalChainStep[];
  defaultTimeoutSeconds?: number;
}

export interface RoomConfigResponse {
  roomId: string;
  config: {
    approvalChain?: ApprovalChainConfig;
    [key: string]: unknown;
  };
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface HitlApprovalRequest {
  id: string;
  roomId: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolCallId?: string;
  status: string;
  currentApproverId?: string | null;
  approvalChainSnapshot?: ApprovalChainConfig;
  startedAt?: string;
  expiresAt?: string | null;
  reason?: string;
}

const BASE = () => getPublicWorkerUrl().replace(/\/$/, "");

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchRoomConfig(token: string, roomId: string): Promise<RoomConfigResponse> {
  return fetchWorkerJson(`${BASE()}/rooms/${encodeURIComponent(roomId)}/config`, {
    headers: authHeaders(token),
  });
}

export async function patchRoomConfig(
  token: string,
  roomId: string,
  config: Record<string, unknown>,
): Promise<RoomConfigResponse> {
  return fetchWorkerJson(`${BASE()}/rooms/${encodeURIComponent(roomId)}/config`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
}

export async function fetchPendingApprovalsForMe(token: string): Promise<HitlApprovalRequest[]> {
  const body = await fetchWorkerJson<{ approvals?: HitlApprovalRequest[] }>(
    `${BASE()}/api/hitl/approvals?approverId=me`,
    { headers: authHeaders(token) },
  );
  return body.approvals ?? [];
}

export async function fetchPendingApprovalsForRoom(
  token: string,
  roomId: string,
): Promise<HitlApprovalRequest[]> {
  const body = await fetchWorkerJson<{ approvals?: HitlApprovalRequest[] }>(
    `${BASE()}/api/hitl/approvals?roomId=${encodeURIComponent(roomId)}`,
    { headers: authHeaders(token) },
  );
  return body.approvals ?? [];
}

export async function fetchHitlSlackUserMap(token: string): Promise<{ slackUserId: string; fluxyUserId: string }[]> {
  const body = await fetchWorkerJson<{ mappings?: { slackUserId: string; fluxyUserId: string }[] }>(
    `${BASE()}/api/hitl/slack-user-map`,
    { headers: authHeaders(token) },
  );
  return body.mappings ?? [];
}

export async function putHitlSlackUserMap(
  token: string,
  slackUserId: string,
  fluxyUserId?: string,
): Promise<void> {
  await fetchWorkerJson(`${BASE()}/api/hitl/slack-user-map`, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ slackUserId, fluxyUserId }),
  });
}

export async function postApprovalDecision(
  token: string,
  approvalRequestId: string,
  decision: "approve" | "reject",
  note?: string,
): Promise<{ approval: HitlApprovalRequest }> {
  return fetchWorkerJson(`${BASE()}/approvals/${encodeURIComponent(approvalRequestId)}/decision`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ decision, note }),
  });
}

export async function fetchHitlEvidence(
  token: string,
  approvalRequestId: string,
): Promise<Record<string, unknown>> {
  const body = await fetchWorkerJson<{ evidence?: Record<string, unknown> }>(
    `${BASE()}/api/hitl/approvals/${encodeURIComponent(approvalRequestId)}/evidence`,
    { headers: authHeaders(token) },
  );
  return body.evidence ?? {};
}

export async function fetchHitlMetrics(token: string): Promise<{
  pending: number;
  decidedLast24h: number;
  uniqueCurrentApprovers: number;
}> {
  const body = await fetchWorkerJson<{
    metrics?: { pending?: number; decidedLast24h?: number; uniqueCurrentApprovers?: number };
  }>(`${BASE()}/api/hitl/metrics`, { headers: authHeaders(token) });
  return {
    pending: Number(body.metrics?.pending || 0),
    decidedLast24h: Number(body.metrics?.decidedLast24h || 0),
    uniqueCurrentApprovers: Number(body.metrics?.uniqueCurrentApprovers || 0),
  };
}

export async function postAgentInboxAction(
  token: string,
  id: string,
  action: "accept" | "edit" | "reply" | "ignore",
  extra?: { reply?: string; edited?: string },
): Promise<void> {
  await fetchWorkerJson(`${BASE()}/inbox/agent/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ action, reply: extra?.reply, edited: extra?.edited }),
  });
}

export function defaultApprovalChain(): ApprovalChainConfig {
  return {
    defaultTimeoutSeconds: 180,
    steps: [
      { approverId: "tier1", timeoutSeconds: 240 },
      { approverId: "tier2", timeoutSeconds: 240 },
      { fallback: "notify_channel" },
    ],
  };
}

export function chainToJson(chain: ApprovalChainConfig): string {
  return JSON.stringify(chain, null, 2);
}

export function parseChainJson(raw: string): ApprovalChainConfig | null {
  try {
    const parsed = JSON.parse(raw) as ApprovalChainConfig;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.steps)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface RoomSystemOneDecision {
  id: string;
  kind: string;
  mode: string;
  model: string | null;
  choice: string | null;
  noul: number | null;
  margin: number | null;
  cascadedFrom: string | null;
  twoKey: boolean;
  toolName: string | null;
  humanOutcome: string | null;
  createdAt: string;
}

export async function fetchRoomSystemOneDecisions(
  token: string,
  roomId: string,
  limit = 40,
): Promise<RoomSystemOneDecision[]> {
  const body = await fetchWorkerJson<{ decisions?: RoomSystemOneDecision[] }>(
    `${BASE()}/rooms/${encodeURIComponent(roomId)}/system-one-decisions?limit=${limit}`,
    { headers: authHeaders(token) },
  );
  return Array.isArray(body.decisions) ? body.decisions : [];
}
