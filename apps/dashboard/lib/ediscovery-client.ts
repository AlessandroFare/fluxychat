import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface EdiscoveryCase {
  id: string;
  projectId: string;
  caseNumber: string;
  title: string;
  description: string | null;
  matter: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  createdBy: string;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
}

export interface EdiscoveryStats {
  totalCases: number;
  byStatus: Record<string, number>;
  totalEvidence: number;
  byEvidenceType: Record<string, number>;
}

export interface EdiscoveryCustodian {
  id: string;
  caseId: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  createdAt: string;
}

export interface EdiscoveryPreservation {
  id: string;
  caseId: string;
  roomId: string | null;
  userId: string | null;
  dataTypes: string | null;
  reason: string | null;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface EdiscoveryEvidence {
  id: string;
  caseId: string;
  itemType: string;
  itemId: string;
  roomId: string | null;
  collectedBy: string;
  collectedAt: string;
  notes: string | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function getEdiscoveryStats(token: string): Promise<{ stats: EdiscoveryStats }> {
  return fetchWorkerJson(`${BASE}/admin/ediscovery/stats`, { headers: authHeaders(token) });
}

export async function listEdiscoveryCases(token: string, status?: string): Promise<{ cases: EdiscoveryCase[] }> {
  const url = new URL(`${BASE}/admin/ediscovery/cases`);
  if (status) url.searchParams.set("status", status);
  return fetchWorkerJson(url.toString(), { headers: authHeaders(token) });
}

export async function createEdiscoveryCase(
  token: string,
  body: { caseNumber: string; title: string; description?: string; matter?: string; priority?: string },
): Promise<{ id: string; created: boolean }> {
  return fetchWorkerJson(`${BASE}/admin/ediscovery/cases`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listEdiscoveryCustodians(
  token: string,
  caseId: string,
): Promise<{ custodians: EdiscoveryCustodian[] }> {
  return fetchWorkerJson(`${BASE}/admin/ediscovery/cases/${encodeURIComponent(caseId)}/custodians`, {
    headers: authHeaders(token),
  });
}

export async function addEdiscoveryCustodian(
  token: string,
  caseId: string,
  body: { userId?: string; name?: string; email?: string; role?: string },
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/admin/ediscovery/cases/${encodeURIComponent(caseId)}/custodians`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function preserveEdiscoveryData(
  token: string,
  caseId: string,
  body: { roomId?: string; userId?: string; dataTypes?: string; reason?: string },
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/admin/ediscovery/cases/${encodeURIComponent(caseId)}/preserve`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listEdiscoveryPreservations(
  token: string,
  caseId: string,
): Promise<{ preservations: EdiscoveryPreservation[] }> {
  return fetchWorkerJson(`${BASE}/admin/ediscovery/cases/${encodeURIComponent(caseId)}/preservations`, {
    headers: authHeaders(token),
  });
}

export async function collectEdiscoveryEvidence(
  token: string,
  caseId: string,
  body: { itemType: string; itemId: string; roomId?: string; notes?: string },
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/admin/ediscovery/cases/${encodeURIComponent(caseId)}/evidence`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listEdiscoveryEvidence(
  token: string,
  caseId: string,
): Promise<{ evidence: EdiscoveryEvidence[] }> {
  return fetchWorkerJson(`${BASE}/admin/ediscovery/cases/${encodeURIComponent(caseId)}/evidence`, {
    headers: authHeaders(token),
  });
}
