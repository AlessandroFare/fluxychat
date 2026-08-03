import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function verifyAuditChain(token: string, limit = 5000) {
  return fetchWorkerJson<{ ok: boolean; valid: boolean; count: number; tipHash?: string; firstBreakId?: number | null }>(
    `${BASE}/admin/audit-chain/verify?limit=${limit}`,
    { headers: authHeaders(token) },
  );
}

export async function exportAuditChain(token: string, limit = 200) {
  return fetchWorkerJson<{ ok: boolean; entries: Array<{ id: number; prevHash: string; eventHash: string; event: unknown; createdAt: string }> }>(
    `${BASE}/admin/audit-chain/export?limit=${limit}`,
    { headers: authHeaders(token) },
  );
}

export async function exportAuditChainToR2(token: string, limit = 5000) {
  return fetchWorkerJson<{
    ok: boolean;
    key?: string;
    bytes?: number;
    entryCount?: number;
    valid?: boolean;
    tipHash?: string;
    error?: string;
  }>(`${BASE}/admin/audit-chain/export-r2`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
}
