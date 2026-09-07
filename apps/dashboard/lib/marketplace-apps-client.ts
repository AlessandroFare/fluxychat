import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface ProjectMarketplaceApp {
  appId: string;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  publisherId: string | null;
  createdAt: number;
}

export async function listProjectMarketplaceApps(token: string): Promise<{ apps: ProjectMarketplaceApp[]; count: number }> {
  return fetchWorkerJson(`${BASE}/admin/marketplace/apps`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function publishProjectMarketplaceApp(
  token: string,
  body: { name: string; description?: string; permissions?: string[] },
): Promise<{ app: ProjectMarketplaceApp }> {
  return fetchWorkerJson(`${BASE}/admin/marketplace/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function deleteProjectMarketplaceApp(token: string, appId: string): Promise<{ deleted: number }> {
  const url = new URL(`${BASE}/admin/marketplace/apps`);
  url.searchParams.set("appId", appId);
  return fetchWorkerJson(url.toString(), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
