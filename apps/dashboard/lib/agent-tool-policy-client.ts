import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface AgentToolPolicyRule {
  id?: string;
  tools?: string[];
  tool?: string;
  effect?: "allow" | "deny" | "require_approval";
  priority?: number;
  reason?: string;
  enabled?: boolean;
}

export interface AgentToolPolicy {
  version: number;
  defaultEffect: string;
  rules: AgentToolPolicyRule[];
}

export async function getAgentToolPolicy(
  token: string,
): Promise<{ policy: AgentToolPolicy | null; enabled: boolean }> {
  return fetchWorkerJson(`${BASE}/agents/tool-policy`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function upsertAgentToolPolicy(
  token: string,
  input: { policy: AgentToolPolicy; enabled?: boolean },
): Promise<{ ok: boolean; policy: AgentToolPolicy }> {
  return fetchWorkerJson(`${BASE}/agents/tool-policy`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function evaluateAgentToolPolicy(
  token: string,
  input: { toolName: string; input?: Record<string, unknown> },
): Promise<{ allowed: boolean; requiresApproval: boolean; denied: boolean; effect: string; ruleId: string }> {
  return fetchWorkerJson(`${BASE}/agents/tool-policy/evaluate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
