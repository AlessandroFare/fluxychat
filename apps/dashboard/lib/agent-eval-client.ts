import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface AgentEvalCase {
  tag?: string;
  name?: string;
  expectedStatus?: string;
  maxLatencyMs?: number;
  agentId?: string;
  roomId?: string;
  sourceRunId?: string;
  capturedError?: string | null;
  capturedAt?: string;
}

export interface AgentEvalDataset {
  id: string;
  name: string;
  description?: string | null;
  cases: AgentEvalCase[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentEvalRunResult {
  id: string;
  datasetId: string;
  status: string;
  passCount: number;
  failCount: number;
  results: Array<{ tag: string; passed: boolean; reason: string }>;
  createdAt: string;
}

export async function listAgentEvalDatasets(token: string) {
  return fetchWorkerJson<{ ok: boolean; datasets: AgentEvalDataset[] }>(
    `${BASE}/admin/agent-eval/datasets`,
    { headers: authHeaders(token) },
  );
}

export async function createAgentEvalDataset(
  token: string,
  body: { name: string; description?: string; cases: AgentEvalCase[] },
) {
  return fetchWorkerJson<{ ok: boolean; dataset: AgentEvalDataset }>(
    `${BASE}/admin/agent-eval/datasets`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) },
  );
}

export async function runAgentEvalDataset(token: string, datasetId: string, agentId?: string) {
  return fetchWorkerJson<{
    ok: boolean;
    evalRunId: string;
    status: string;
    passCount: number;
    failCount: number;
    results: Array<{ tag: string; passed: boolean; reason: string }>;
  }>(`${BASE}/admin/agent-eval/datasets/${encodeURIComponent(datasetId)}/run`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ agentId }),
  });
}

export async function listAgentEvalRuns(token: string, datasetId?: string) {
  const q = datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : "";
  return fetchWorkerJson<{ ok: boolean; runs: AgentEvalRunResult[] }>(
    `${BASE}/admin/agent-eval/runs${q}`,
    { headers: authHeaders(token) },
  );
}

export async function exportAgentRunsOtel(token: string, limit = 100) {
  return fetchWorkerJson<{ ok: boolean; spanCount: number; payload: unknown }>(
    `${BASE}/admin/agent-eval/export-otel`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify({ limit }) },
  );
}

export async function captureFailedRunAsEvalCase(
  token: string,
  runId: string,
  datasetId?: string,
) {
  return fetchWorkerJson<{
    ok: boolean;
    duplicate?: boolean;
    datasetId: string;
    caseCount: number;
    evalCase: AgentEvalCase;
    sourceRunId: string;
    error?: string;
  }>(`${BASE}/admin/agent-eval/from-run/${encodeURIComponent(runId)}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ datasetId }),
  });
}
