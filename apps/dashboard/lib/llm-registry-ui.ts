import { AGENT_PROVIDER_OPTIONS } from "@/lib/agent-catalog";
import type {
  LlmCatalogProvider,
  LlmCatalogResponse,
  ModelCapabilities,
} from "@/lib/llm-catalog-client";

export interface ProviderOption {
  id: string;
  label: string;
  apiStyle?: string;
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  allowCustomBaseUrl?: boolean;
  credentialStatus?: LlmCatalogProvider["credentialStatus"];
}

export function listProviderOptions(
  catalog: LlmCatalogResponse | null,
): ProviderOption[] {
  if (catalog?.providers?.length) {
    return catalog.providers.map((p) => ({
      id: p.id,
      label: p.label,
      apiStyle: p.apiStyle,
      supportsStreaming: p.supportsStreaming,
      supportsTools: p.supportsTools,
      allowCustomBaseUrl: p.allowCustomBaseUrl,
      credentialStatus: p.credentialStatus,
    }));
  }
  return AGENT_PROVIDER_OPTIONS.map((p) => ({
    id: p.id,
    label: p.label,
    allowCustomBaseUrl: p.allowCustomBaseUrl,
  }));
}

export function findCatalogProvider(
  catalog: LlmCatalogResponse | null,
  providerId: string,
): LlmCatalogProvider | undefined {
  return catalog?.providers.find((p) => p.id === providerId);
}

export function resolveModelCapabilities(
  catalog: LlmCatalogResponse | null,
  providerId: string,
  modelId: string,
): ModelCapabilities | null {
  const prov = findCatalogProvider(catalog, providerId);
  return prov?.models.find((m) => m.id === modelId)?.capabilities ?? null;
}

export function credentialStatusSummary(
  status: LlmCatalogProvider["credentialStatus"] | undefined,
): { ready: boolean; label: string } {
  if (!status) {
    return { ready: false, label: "Keys unknown — load catalog" };
  }
  const projectOk = status.project === "configured";
  const workerOk = status.worker === "configured";
  if (projectOk) {
    return { ready: true, label: "Project API key" };
  }
  if (workerOk) {
    return { ready: true, label: "Worker env key" };
  }
  return { ready: false, label: "No API key — add under LLM keys" };
}
