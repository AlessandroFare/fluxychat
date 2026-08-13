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
