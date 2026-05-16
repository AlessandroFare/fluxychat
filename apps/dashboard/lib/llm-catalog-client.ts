import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

export interface ModelCapabilities {
  imageInput?: boolean;
  objectGeneration?: boolean;
  toolUsage?: boolean;
  toolStreaming?: boolean;
}

export interface LlmCatalogModel {
  id: string;
  providerId: string;
  capabilities: ModelCapabilities;
}

export interface LlmCatalogProvider {
  id: string;
  label: string;
  apiStyle: string;
  models: LlmCatalogModel[];
  supportsStreaming: boolean;
  supportsTools: boolean;
  allowCustomBaseUrl?: boolean;
  credentialStatus?: {
    project: "configured" | "missing";
    worker: "configured" | "missing";
    baseUrl?: string | null;
  };
}

export interface LlmCatalogResponse {
  providers: LlmCatalogProvider[];
  shortcuts: Array<{ alias: string; modelRef: string; capabilities: ModelCapabilities }>;
  capabilityLegend: Record<string, string>;
  docsUrl: string;
  liveModels?: {
    source: string;
    fetchedAt: string;
    models: Array<{ id: string; name: string; providerId: string }>;
  };
}

export interface ProjectLlmCredential {
  providerId: string;
  label: string;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  baseUrl: string | null;
  updatedAt: string;
  source: string;
}

export async function fetchLlmCatalog(
  token: string,
  options?: { live?: boolean },
): Promise<LlmCatalogResponse> {
  const url = new URL("/llm/providers", getPublicWorkerUrl());
  if (options?.live) url.searchParams.set("live", "1");
  return fetchWorkerJson<LlmCatalogResponse>(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchProjectLlmCredentials(
  token: string,
): Promise<ProjectLlmCredential[]> {
  const body = await fetchWorkerJson<{ credentials?: ProjectLlmCredential[] }>(
    `${getPublicWorkerUrl()}/projects/llm/credentials`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return body.credentials ?? [];
}

export async function saveProjectLlmCredential(
  token: string,
  providerId: string,
  body: { apiKey?: string; baseUrl?: string; clearApiKey?: boolean },
): Promise<void> {
  await fetchWorkerJson(
    `${getPublicWorkerUrl()}/projects/llm/credentials/${encodeURIComponent(providerId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );
}
