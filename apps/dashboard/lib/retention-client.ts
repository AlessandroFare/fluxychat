import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface RetentionPolicy {
  id: string;
  projectId: string;
  name: string;
  roomId: string | null;
  retentionDays: number;
  autoDelete: boolean;
  requireApproval: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LegalHold {
  id: string;
  projectId: string;
  roomId: string | null;
  reason: string;
  placedBy: string;
  expiresAt: string | null;
  createdAt: string;
  releasedAt: string | null;
}

export interface ExportSnapshot {
  id: string;
  projectId: string;
  roomId: string | null;
  format: string;
  messageCount: number;
  requestedBy: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listRetentionPolicies(token: string): Promise<{ policies: RetentionPolicy[] }> {
  return fetchWorkerJson(`${BASE}/enterprise/retention/policies`, { headers: authHeaders(token) });
}

export async function createRetentionPolicy(
  token: string,
  body: { name: string; roomId?: string; retentionDays: number; autoDelete?: boolean },
): Promise<RetentionPolicy> {
  return fetchWorkerJson(`${BASE}/enterprise/retention/policies`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listLegalHolds(token: string, roomId?: string): Promise<{ holds: LegalHold[] }> {
  const url = new URL(`${BASE}/enterprise/retention/holds`);
  if (roomId) url.searchParams.set("roomId", roomId);
  return fetchWorkerJson(url.href, { headers: authHeaders(token) });
}

export async function createLegalHold(
  token: string,
  body: { roomId?: string; reason: string; expiresAt?: string },
): Promise<LegalHold> {
  return fetchWorkerJson(`${BASE}/enterprise/retention/holds`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function releaseLegalHold(token: string, holdId: string): Promise<{ ok: boolean }> {
  return fetchWorkerJson(`${BASE}/enterprise/retention/holds/${encodeURIComponent(holdId)}/release`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function listExportSnapshots(token: string): Promise<{ snapshots: ExportSnapshot[] }> {
  return fetchWorkerJson(`${BASE}/enterprise/retention/exports`, { headers: authHeaders(token) });
}

export async function createExportSnapshot(
  token: string,
  body: { roomId?: string; format?: string },
): Promise<ExportSnapshot> {
  return fetchWorkerJson(`${BASE}/enterprise/retention/exports`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
