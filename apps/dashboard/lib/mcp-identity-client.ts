import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface McpServerEntry {
  name: string;
  version: string;
  vendor: string;
  description: string;
  instructions: string;
  registeredAt: string;
}

export interface McpToolEntry {
  serverName: string;
  serverVersion: string;
  toolName: string;
  instructions: string;
  origin: string;
  registeredAt: string;
}

export interface McpIdentityRegistry {
  servers: McpServerEntry[];
  tools: McpToolEntry[];
}

export interface McpToolAuditEntry {
  id: string;
  serverName: string;
  toolName: string;
  userId?: string | null;
  agentId?: string | null;
  success?: boolean;
  detail?: string | null;
  timestamp: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function getMcpIdentityRegistry(token: string): Promise<{
  registry: McpIdentityRegistry;
  builtinServerInfo?: Record<string, unknown>;
}> {
  return fetchWorkerJson(`${BASE}/admin/mcp-identity/registry`, { headers: authHeaders(token) });
}

export async function listMcpToolAudit(
  token: string,
  limit = 50,
): Promise<{ entries: McpToolAuditEntry[]; count: number }> {
  const url = new URL(`${BASE}/admin/mcp-identity/audit`);
  url.searchParams.set("limit", String(limit));
  return fetchWorkerJson(url.toString(), { headers: authHeaders(token) });
}

export async function registerMcpServer(
  token: string,
  body: { name: string; version?: string; vendor?: string; description?: string; instructions?: string },
): Promise<{ server: McpServerEntry }> {
  return fetchWorkerJson(`${BASE}/admin/mcp-identity/servers`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function registerMcpToolProvenance(
  token: string,
  body: { serverName: string; toolName: string; instructions?: string; origin?: string },
): Promise<{ tool: McpToolEntry }> {
  return fetchWorkerJson(`${BASE}/admin/mcp-identity/tools`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
