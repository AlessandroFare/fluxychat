import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export type EuRiskCategory = "minimal" | "limited" | "high" | "unacceptable";
export type HumanOversightLevel = "human_in_loop" | "human_on_loop" | "human_in_command";
export type HitlMode = "none" | "side_effect" | "all_tools";

export interface EuAiActSettings {
  enabled: boolean;
  providerLegalName: string | null;
  providerContact: string | null;
  enforceAiDisclosure: boolean;
  enforceHitlHighRisk: boolean;
  recordRetentionDays: number;
  requireConformityForHighRisk: boolean;
  blockUnacceptableRisk: boolean;
  updatedAt: string | null;
  configured: boolean;
}

export interface AgentEuAiActProfile {
  id: string;
  agentId: string;
  intendedPurpose: string;
  euRiskCategory: EuRiskCategory;
  annexIIICategory: string | null;
  humanOversightLevel: HumanOversightLevel;
  hitlMode: HitlMode;
  requiresDisclosure: boolean;
  dataCategories: string[];
  prohibitedUseConfirmed: boolean;
  conformityAssessed: boolean;
  conformityAssessedAt: string | null;
  conformityAssessedBy: string | null;
  technicalDocVersion: string;
  updatedAt: string;
}

export interface EuAiActGap {
  id: string;
  article: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  fixPath: string;
}

export interface EuAiActAssessment {
  assessedAt: string;
  projectId: string;
  score: number;
  readyForProduction: boolean;
  summary: {
    agents: number;
    profiles: number;
    gaps: number;
    critical: number;
    high: number;
  };
  gaps: EuAiActGap[];
  settings: EuAiActSettings;
}

export interface AnnexIIICategory {
  id: string;
  label: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function getEuAiActSettings(token: string): Promise<{
  settings: EuAiActSettings;
  annexIIICategories: AnnexIIICategory[];
}> {
  return fetchWorkerJson(`${BASE}/admin/eu-ai-act/settings`, { headers: authHeaders(token) });
}

export async function updateEuAiActSettings(
  token: string,
  body: Partial<EuAiActSettings>,
): Promise<{ settings: EuAiActSettings }> {
  return fetchWorkerJson(`${BASE}/admin/eu-ai-act/settings`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listEuAiActProfiles(token: string): Promise<{ profiles: AgentEuAiActProfile[] }> {
  return fetchWorkerJson(`${BASE}/admin/eu-ai-act/agents`, { headers: authHeaders(token) });
}

export async function upsertEuAiActProfile(
  token: string,
  agentId: string,
  body: Partial<AgentEuAiActProfile> & { intendedPurpose: string; euRiskCategory: EuRiskCategory },
): Promise<{ profile: AgentEuAiActProfile }> {
  return fetchWorkerJson(`${BASE}/admin/eu-ai-act/agents/${encodeURIComponent(agentId)}`, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getEuAiActAssessment(token: string): Promise<{ assessment: EuAiActAssessment }> {
  return fetchWorkerJson(`${BASE}/admin/eu-ai-act/assessment`, { headers: authHeaders(token) });
}

export async function exportEuAiActTechnicalDocumentation(token: string): Promise<Record<string, unknown>> {
  const res = await fetchWorkerJson<{ documentation: Record<string, unknown> }>(
    `${BASE}/admin/eu-ai-act/technical-documentation`,
    { headers: authHeaders(token) },
  );
  return res.documentation;
}

export async function listEuAiActAuditLog(
  token: string,
  opts?: { agentId?: string; limit?: number },
): Promise<{ events: Array<{ id: string; eventType: string; createdAt: string; agentId?: string }> }> {
  const params = new URLSearchParams();
  if (opts?.agentId) params.set("agentId", opts.agentId);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return fetchWorkerJson(`${BASE}/admin/eu-ai-act/audit-log${qs ? `?${qs}` : ""}`, {
    headers: authHeaders(token),
  });
}
