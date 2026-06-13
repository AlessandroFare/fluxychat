import { buildAgentLlmConfig } from "@/lib/agent-catalog";

export interface AgentFormValues {
  name: string;
  handle: string;
  provider: string;
  model: string;
  capabilities: string;
  systemPrompt: string;
  contextFetchUrl: string;
  toolExecuteUrl: string;
  llmBaseUrl: string;
  fallbackProvider: string;
  fallbackModel: string;
}

export interface AgentRecord {
  id: string;
  projectId: string;
  name: string;
  handle?: string | null;
  provider?: string | null;
  model?: string | null;
  capabilities?: string[];
  systemPrompt?: string | null;
  contextFetchUrl?: string | null;
  toolExecuteUrl?: string | null;
  toolsSchema?: unknown[] | null;
  rateLimitRpm?: number | null;
  config?: Record<string, unknown> | null;
  createdAt?: string;
}

export function emptyAgentForm(): AgentFormValues {
  return {
    name: "",
    handle: "",
    provider: "openai",
    model: "gpt-4o-mini",
    capabilities: "chat",
    systemPrompt: "",
    contextFetchUrl: "",
    toolExecuteUrl: "",
    llmBaseUrl: "",
    fallbackProvider: "",
    fallbackModel: "",
  };
}

export function agentToFormValues(agent: AgentRecord): AgentFormValues {
  const cfg = agent.config as {
    llm?: { baseUrl?: string; fallbackProvider?: string; fallbackModel?: string };
  } | null | undefined;
  return {
    name: agent.name,
    handle: agent.handle || "",
    provider: agent.provider || "openai",
    model: agent.model || "",
    capabilities: (agent.capabilities || ["chat"]).join(","),
    systemPrompt: agent.systemPrompt || "",
    contextFetchUrl: agent.contextFetchUrl || "",
    toolExecuteUrl: agent.toolExecuteUrl || "",
    llmBaseUrl: cfg?.llm?.baseUrl || "",
    fallbackProvider: cfg?.llm?.fallbackProvider || "",
    fallbackModel: cfg?.llm?.fallbackModel || "",
  };
}

export function agentFromApiResponse(
  row: Partial<AgentRecord> & Pick<AgentRecord, "id" | "name">,
  projectId: string,
): AgentRecord {
  return {
    projectId: row.projectId ?? projectId,
    id: row.id,
    name: row.name,
    handle: row.handle ?? null,
    provider: row.provider ?? null,
    model: row.model ?? null,
    capabilities: row.capabilities ?? [],
    systemPrompt: row.systemPrompt ?? null,
    contextFetchUrl: row.contextFetchUrl ?? null,
    toolExecuteUrl: row.toolExecuteUrl ?? null,
    toolsSchema: row.toolsSchema ?? null,
    rateLimitRpm: row.rateLimitRpm ?? null,
    config: row.config ?? null,
    createdAt: row.createdAt,
  };
}

export function agentFormToPayload(form: AgentFormValues) {
  return {
    name: form.name.trim(),
    handle: form.handle.trim() || undefined,
    provider: form.provider.trim() || undefined,
    model: form.model.trim() || undefined,
    capabilities: form.capabilities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    systemPrompt: form.systemPrompt.trim() || undefined,
    contextFetchUrl: form.contextFetchUrl.trim() || undefined,
    toolExecuteUrl: form.toolExecuteUrl.trim() || undefined,
    config: buildAgentLlmConfig({
      provider: form.provider,
      llmBaseUrl: form.llmBaseUrl,
      fallbackProvider: form.fallbackProvider,
      fallbackModel: form.fallbackModel,
    }),
  };
}
