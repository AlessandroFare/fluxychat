import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface WorkflowDefinition {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  triggerType: string;
  triggerConfig: Record<string, unknown> | null;
  actions: Array<Record<string, unknown>>;
  conditions: Record<string, unknown> | null;
  runCount?: number;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listWorkflows(token: string): Promise<WorkflowDefinition[]> {
  const res = await fetchWorkerJson<{ workflows?: WorkflowDefinition[] } | WorkflowDefinition[]>(
    `${BASE}/api/workflows`,
    { headers: authHeaders(token) },
  );
  if (Array.isArray(res)) return res;
  return res.workflows ?? [];
}

export async function createWorkflow(
  token: string,
  body: {
    name: string;
    description?: string;
    triggerType: string;
    triggerConfig?: Record<string, unknown>;
    actions: Array<Record<string, unknown>>;
    conditions?: Record<string, unknown>;
  },
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/api/workflows`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function runWorkflow(
  token: string,
  workflowId: string,
  triggerData?: Record<string, unknown>,
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/api/workflows/${encodeURIComponent(workflowId)}/run`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ triggerData: triggerData ?? {} }),
  });
}
