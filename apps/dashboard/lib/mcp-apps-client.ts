import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface McpAppCatalogEntry {
  id: string;
  name: string;
  vendor: string;
  verified: boolean;
  auditLevel: string;
  description: string;
  category: string;
  tools: string[];
}

export interface McpAppInstall {
  appId: string;
  agentId: string | null;
  installedBy: string | null;
  installedAt: string;
}

export async function listMcpAppsCatalog(): Promise<{ apps: McpAppCatalogEntry[]; count: number }> {
  return fetchWorkerJson(`${BASE}/marketplace/mcp-apps`);
}

export async function listInstalledMcpApps(token: string): Promise<{ installed: McpAppInstall[]; count: number }> {
  return fetchWorkerJson(`${BASE}/admin/mcp-apps/installed`, { headers: { Authorization: `Bearer ${token}` } });
}

export async function installMcpApp(
  token: string,
  appId: string,
  agentId?: string,
): Promise<{ installed: boolean; app: { id: string; name: string } }> {
  return fetchWorkerJson(`${BASE}/admin/mcp-apps/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ appId, agentId }),
  });
}

export async function uninstallMcpApp(token: string, appId: string, agentId?: string): Promise<{ uninstalled: number }> {
  const url = new URL(`${BASE}/admin/mcp-apps/install`);
  url.searchParams.set("appId", appId);
  if (agentId) url.searchParams.set("agentId", agentId);
  return fetchWorkerJson(url.toString(), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
