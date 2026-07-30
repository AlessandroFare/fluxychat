import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export type RiskTier = "low" | "medium" | "high" | "critical";

export interface GovernanceModel {
  modelId: string;
  provider: string;
  version: string;
  riskTier: RiskTier;
  allowedUseCases: string[];
  approvedBy: string | null;
  approvedAt: string | null;
  registeredAt: string;
}

export interface GovernancePrompt {
  promptId: string;
  template: string;
  riskTier: RiskTier;
  allowedModels: string[];
  requiredApprovals: string[];
  status: string;
  registeredAt: string;
}

export interface GovernanceTool {
  toolId: string;
  name: string;
  riskTier: RiskTier;
  allowedRoles: string[];
  requiresApproval: boolean;
  rateLimit: number;
  registeredAt: string;
}

export interface GovernanceEvaluation {
  evaluationId: string;
  targetId: string;
  targetType: "model" | "prompt" | "tool";
  score: number;
  passed: boolean;
  evidence: string;
  evaluatedAt: string;
  evaluatedBy: string | null;
}

export interface GovernanceRegistry {
  models: GovernanceModel[];
  prompts: GovernancePrompt[];
  tools: GovernanceTool[];
  evaluations: GovernanceEvaluation[];
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function getGovernanceRegistry(token: string): Promise<{ registry: GovernanceRegistry }> {
  return fetchWorkerJson(`${BASE}/admin/ai-governance/registry`, { headers: authHeaders(token) });
}

export async function registerGovernanceModel(
  token: string,
  body: { modelId: string; provider: string; version?: string; riskTier: RiskTier; allowedUseCases?: string[] },
): Promise<{ model: GovernanceModel }> {
  return fetchWorkerJson(`${BASE}/admin/ai-governance/models`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function registerGovernancePrompt(
  token: string,
  body: { promptId: string; template: string; riskTier: RiskTier; allowedModels?: string[] },
): Promise<{ prompt: GovernancePrompt }> {
  return fetchWorkerJson(`${BASE}/admin/ai-governance/prompts`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function registerGovernanceTool(
  token: string,
  body: { toolId: string; name: string; riskTier: RiskTier; requiresApproval?: boolean },
): Promise<{ tool: GovernanceTool }> {
  return fetchWorkerJson(`${BASE}/admin/ai-governance/tools`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function runGovernanceEvaluation(
  token: string,
  body: { targetId: string; targetType: "model" | "prompt" | "tool" },
): Promise<{ evaluation: GovernanceEvaluation; passed: boolean }> {
  return fetchWorkerJson(`${BASE}/admin/ai-governance/evaluate`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function exportGovernanceEvidence(token: string): Promise<Record<string, unknown>> {
  return fetchWorkerJson(`${BASE}/admin/ai-governance/evidence`, { headers: authHeaders(token) });
}

export async function listAiActionPolicies(token: string): Promise<{ policies: unknown[]; count: number }> {
  return fetchWorkerJson(`${BASE}/enterprise/ai-policies`, { headers: authHeaders(token) });
}

export async function getAiPolicyViolations(token: string): Promise<Record<string, unknown>> {
  return fetchWorkerJson(`${BASE}/enterprise/ai-policies/violations`, { headers: authHeaders(token) });
}
