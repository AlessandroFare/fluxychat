export interface AgentProviderOption {
  id: string;
  label: string;
  models: readonly string[];
  allowCustomBaseUrl?: boolean;
  hint?: string;
}

/** Keep in sync with apps/worker/src/lib/llm-providers.js */
export const AGENT_PROVIDER_OPTIONS: AgentProviderOption[] = [
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    models: [],
    allowCustomBaseUrl: true,
  },
] as const;

const REGISTRY_IDS = new Set(AGENT_PROVIDER_OPTIONS.map((p) => p.id));

export function expandModelShortcut(input: string): string {
  return input.trim();
}

export interface ParsedModelRef {
  providerId: string;
  modelId: string;
  modelRef: string;
}

/** Client-side parse aligned with worker parseModelRef. */
export function parseModelRef(
  providerField: string,
  modelField: string,
): ParsedModelRef {
  let providerId = providerField.trim().toLowerCase();
  let modelRaw = modelField.trim();

  if (modelRaw.includes("/")) {
    const slashIdx = modelRaw.indexOf("/");
    const prefix = modelRaw.slice(0, slashIdx).toLowerCase();
    const rest = modelRaw.slice(slashIdx + 1);
    if (REGISTRY_IDS.has(prefix) && (!providerId || providerId === prefix)) {
      providerId = prefix;
      modelRaw = rest;
    } else if (!providerId) {
      providerId = prefix;
      modelRaw = rest;
    }
  }

  if (!providerId) providerId = "custom";

  return {
    providerId,
    modelId: modelRaw || "",
    modelRef: formatModelRef(providerId, modelId || ""),
  };
}

export function formatModelRef(providerId: string, modelId: string): string {
  if (!modelId) return providerId;
  if (modelId.includes("/")) {
    const prefix = modelId.split("/")[0].toLowerCase();
    if (prefix === providerId) return modelId;
  }
  return `${providerId}/${modelId}`;
}

export function normalizeAgentLlmFields(provider: string, model: string) {
  return parseModelRef(provider, model);
}

export function providerAllowsCustomBaseUrl(provider: string): boolean {
  const match = AGENT_PROVIDER_OPTIONS.find((p) => p.id === provider);
  return !!match?.allowCustomBaseUrl;
}

export function providerHint(provider: string): string | undefined {
  return AGENT_PROVIDER_OPTIONS.find((p) => p.id === provider)?.hint;
}

export interface AgentLlmConfigInput {
  provider: string;
  llmBaseUrl: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string;
}

export function buildAgentLlmConfig(
  input: AgentLlmConfigInput,
): { llm: Record<string, string>; modelParams?: Record<string, unknown> } | undefined {
  const llm: Record<string, string> = {};
  const trimmedBase = input.llmBaseUrl.trim();
  if (trimmedBase && providerAllowsCustomBaseUrl(input.provider)) {
    llm.baseUrl = trimmedBase;
  }
  const fbProvider = (input.fallbackProvider ?? "").trim();
  const fbModel = (input.fallbackModel ?? "").trim();
  if (fbProvider) {
    llm.fallbackProvider = fbProvider;
    if (fbModel) llm.fallbackModel = fbModel;
  }

  const modelParams: Record<string, unknown> = {};
  if (input.temperature !== undefined && input.temperature !== 0.7) modelParams.temperature = input.temperature;
  if (input.maxTokens !== undefined && input.maxTokens !== 1024) modelParams.maxTokens = input.maxTokens;
  if (input.topP !== undefined && input.topP !== 1) modelParams.topP = input.topP;
  if (input.frequencyPenalty !== undefined && input.frequencyPenalty !== 0) modelParams.frequencyPenalty = input.frequencyPenalty;
  if (input.presencePenalty !== undefined && input.presencePenalty !== 0) modelParams.presencePenalty = input.presencePenalty;
  if (input.stopSequences?.trim()) modelParams.stopSequences = input.stopSequences.trim();

  const result: Record<string, unknown> = {};
  if (Object.keys(llm).length) result.llm = llm;
  if (Object.keys(modelParams).length) result.modelParams = modelParams;
  return Object.keys(result).length ? result as any : undefined;
}

/** When user types a composite ref, sync provider + model fields. */
export function applyModelInput(provider: string, modelInput: string): {
  provider: string;
  model: string;
} {
  const parsed = parseModelRef(provider, modelInput);
  return { provider: parsed.providerId, model: parsed.modelId };
}

