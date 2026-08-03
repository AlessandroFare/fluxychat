import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface TruthClaim {
  id: string;
  projectId: string;
  roomId: string;
  messageId: number | null;
  agentId: string | null;
  content: string;
  stakedByUserId: string;
  stakeAmount: number;
  currency: string;
  ttlSeconds: number;
  state: string;
  expiresAt: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface TruthDispute {
  id: string;
  claimId: string;
  projectId: string;
  disputedByUserId: string;
  evidence: string;
  state: string;
  resolvedByUserId: string | null;
  outcome: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listTruthClaims(
  token: string,
  options?: { roomId?: string; state?: string },
): Promise<{ ok: boolean; claims: TruthClaim[] }> {
  const url = new URL(`${BASE}/truth-claims`);
  if (options?.roomId) url.searchParams.set("roomId", options.roomId);
  if (options?.state) url.searchParams.set("state", options.state);
  return fetchWorkerJson(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
}

export async function createTruthClaim(
  token: string,
  roomId: string,
  input: { content: string; stakeAmount: number; messageId?: number; ttlSeconds?: number },
): Promise<{ ok: boolean; claim?: TruthClaim; error?: string }> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/truth-claims`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function fileTruthDispute(
  token: string,
  claimId: string,
  evidence: string,
): Promise<{ ok: boolean; dispute?: TruthDispute; error?: string }> {
  return fetchWorkerJson(`${BASE}/truth-claims/${encodeURIComponent(claimId)}/disputes`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ evidence }),
  });
}

export async function resolveTruthDispute(
  token: string,
  claimId: string,
  disputeId: string,
  outcome: "confirmed" | "rejected",
): Promise<{ ok: boolean; claim?: TruthClaim; dispute?: TruthDispute; error?: string }> {
  return fetchWorkerJson(
    `${BASE}/admin/truth-claims/${encodeURIComponent(claimId)}/disputes/${encodeURIComponent(disputeId)}/resolve`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ outcome }),
    },
  );
}

export async function getTruthCredits(
  token: string,
): Promise<{ ok: boolean; credits: { balance: number; updatedAt: string | null } }> {
  return fetchWorkerJson(`${BASE}/admin/truth-market/credits`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function grantTruthCredits(
  token: string,
  input: { userId?: string; amount: number; reason?: string },
): Promise<{ ok: boolean; credits?: { balance: number } }> {
  return fetchWorkerJson(`${BASE}/admin/truth-market/credits/grant`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function getTruthClaimDetail(
  token: string,
  claimId: string,
): Promise<{ ok: boolean; claim: TruthClaim; disputes: TruthDispute[] }> {
  return fetchWorkerJson(`${BASE}/truth-claims/${encodeURIComponent(claimId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
