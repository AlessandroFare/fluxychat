import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

export interface MarketplaceAgent {
  id: string;
  publisherId: string;
  name: string;
  slug: string;
  description: string | null;
  longDescription: string | null;
  category: string;
  iconUrl: string | null;
  configTemplate: Record<string, unknown>;
  systemPrompt: string | null;
  tools: unknown[] | null;
  integrations: unknown[] | null;
  pricing: string;
  pricingConfig: Record<string, unknown> | null;
  version: string;
  status: string;
  installCount: number;
  avgRating: number;
  reviewCount: number;
  featured: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceInstall {
  id: string;
  agentId: string;
  projectId: string;
  installedBy: string;
  configOverride: Record<string, unknown> | null;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
}

export interface MarketplaceReview {
  id: string;
  agentId: string;
  projectId: string;
  userId: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
}

export interface MarketplaceStats {
  totalAgents: number;
  totalInstalls: number;
  avgRating: number;
  byCategory: Array<{ category: string; agents: number; installs: number }>;
}

const BASE = getPublicWorkerUrl();

export async function listMarketplaceAgents(opts?: {
  category?: string;
  search?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<MarketplaceAgent[]> {
  const url = new URL("/marketplace/agents", BASE);
  url.searchParams.set("status", "published");
  if (opts?.category) url.searchParams.set("category", opts.category);
  if (opts?.search) url.searchParams.set("search", opts.search);
  if (opts?.sort) url.searchParams.set("sort", opts.sort);
  if (opts?.limit) url.searchParams.set("limit", String(opts.limit));
  if (opts?.offset) url.searchParams.set("offset", String(opts.offset));
  const res = await fetchWorkerJson<{ agents: MarketplaceAgent[] }>(url.toString());
  return res.agents;
}

export async function getMarketplaceAgent(slug: string): Promise<MarketplaceAgent | null> {
  const url = new URL(`/marketplace/agents/${encodeURIComponent(slug)}`, BASE);
  try {
    const res = await fetchWorkerJson<{ agent: MarketplaceAgent }>(url.toString());
    return res.agent;
  } catch {
    return null;
  }
}

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  const url = new URL("/marketplace/stats", BASE);
  const res = await fetchWorkerJson<{ stats: MarketplaceStats }>(url.toString());
  return res.stats;
}

export async function installMarketplaceAgent(
  token: string,
  agentId: string,
  opts?: { installedBy?: string; configOverride?: Record<string, unknown> },
): Promise<{ id: string; installed: boolean }> {
  return fetchWorkerJson<{ id: string; installed: boolean }>(
    `${BASE}/admin/marketplace/install`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        agentId,
        installedBy: opts?.installedBy,
        configOverride: opts?.configOverride,
      }),
    },
  );
}

export async function uninstallMarketplaceAgent(
  token: string,
  agentId: string,
): Promise<{ uninstalled: number }> {
  return fetchWorkerJson<{ uninstalled: number }>(
    `${BASE}/admin/marketplace/install?agentId=${encodeURIComponent(agentId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export async function listInstalledMarketplaceAgents(
  token: string,
): Promise<MarketplaceInstall[]> {
  const res = await fetchWorkerJson<{ agents: MarketplaceInstall[] }>(
    `${BASE}/admin/marketplace/installed`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.agents;
}

export async function publishMarketplaceAgent(
  token: string,
  body: {
    name: string;
    slug: string;
    description?: string;
    longDescription?: string;
    category?: string;
    iconUrl?: string;
    configTemplate: Record<string, unknown>;
    systemPrompt?: string;
    tools?: unknown[];
    integrations?: unknown[];
    pricing?: string;
    pricingConfig?: Record<string, unknown>;
    version?: string;
    tags?: string[];
  },
): Promise<{ id: string; created: boolean }> {
  return fetchWorkerJson<{ id: string; created: boolean }>(
    `${BASE}/admin/marketplace/agents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  );
}

export async function createAgentFromTemplate(
  token: string,
  template: MarketplaceAgent,
): Promise<{ agent?: { id: string; name: string } }> {
  const model = (template.configTemplate.model as string) || "gpt-4o-mini";
  const provider = (template.configTemplate.provider as string) || "openai";
  return fetchWorkerJson<{ agent?: { id: string; name: string } }>(
    `${BASE}/agents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: template.name,
        handle: template.slug,
        provider,
        model,
        capabilities: ["chat"],
        systemPrompt: template.systemPrompt || undefined,
        config: template.configTemplate,
      }),
    },
  );
}
