import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function createLangfuseOtelConfig(
  token: string,
  body: {
    host?: string;
    publicKey: string;
    secretKey: string;
    name?: string;
  },
): Promise<{ id: string; created: boolean }> {
  return fetchWorkerJson(`${BASE}/otel/configs/langfuse`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function flushOtelQueue(
  token: string,
  configId?: string,
): Promise<{ results: Array<{ configId: string; exported?: number; failed?: number }> }> {
  return fetchWorkerJson(`${BASE}/otel/flush`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(configId ? { configId } : {}),
  });
}
