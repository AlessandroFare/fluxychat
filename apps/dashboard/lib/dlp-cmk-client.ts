import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface DlpRule {
  id: string;
  projectId: string;
  name: string;
  ruleType: string;
  pattern: string;
  action: string;
  severity: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DlpPolicyVersion {
  version: string;
  builtinPatternCount: number;
  customRuleCount: number;
  enabledRuleCount: number;
  updatedAt: string | null;
}

export interface DlpScanResult {
  matches: Array<{ type?: string; severity?: string; action?: string; matchedText?: string }>;
  matchCount: number;
  contentKind: string;
  policyVersion: DlpPolicyVersion;
  action: string;
  redactedText?: string;
}

export interface CmkKey {
  keyId: string;
  algorithm: string;
  status: string;
  tenantId: string;
  createdAt: string;
  createdBy: string | null;
  rotatedAt?: string;
  revokedAt?: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listDlpRules(token: string): Promise<{ rules: DlpRule[]; count: number }> {
  return fetchWorkerJson(`${BASE}/enterprise/dlp/rules`, { headers: authHeaders(token) });
}

export async function createDlpRule(
  token: string,
  body: { name: string; pattern: string; ruleType?: string; action?: string; severity?: string },
): Promise<DlpRule> {
  return fetchWorkerJson(`${BASE}/enterprise/dlp/rules`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteDlpRule(token: string, ruleId: string): Promise<{ ok: boolean }> {
  return fetchWorkerJson(`${BASE}/enterprise/dlp/rules/${encodeURIComponent(ruleId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function getDlpPolicyVersion(token: string): Promise<DlpPolicyVersion> {
  return fetchWorkerJson(`${BASE}/enterprise/dlp/policy-version`, { headers: authHeaders(token) });
}

export async function scanDlpContent(
  token: string,
  body: { text: string; contentKind?: string; roomId?: string; messageId?: number },
): Promise<DlpScanResult> {
  return fetchWorkerJson(`${BASE}/enterprise/dlp/scan`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listCmkKeys(token: string): Promise<{ keys: CmkKey[] }> {
  return fetchWorkerJson(`${BASE}/admin/cmk/keys`, { headers: authHeaders(token) });
}

export async function createCmkKey(
  token: string,
  algorithm?: string,
): Promise<{ key: CmkKey }> {
  return fetchWorkerJson(`${BASE}/admin/cmk/keys`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ algorithm }),
  });
}

export async function rotateCmkKey(token: string, keyId: string): Promise<{ key: CmkKey }> {
  return fetchWorkerJson(`${BASE}/admin/cmk/keys/${encodeURIComponent(keyId)}/rotate`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function revokeCmkKey(token: string, keyId: string): Promise<{ ok: boolean }> {
  return fetchWorkerJson(`${BASE}/admin/cmk/keys/${encodeURIComponent(keyId)}/revoke`, {
    method: "POST",
    headers: authHeaders(token),
  });
}
