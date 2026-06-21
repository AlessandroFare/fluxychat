export interface AgentProviderOption {
  id: string;
  label: string;
  models: readonly string[];
  allowCustomBaseUrl?: boolean;
  hint?: string;
}

/** Shortcuts → `provider/model` (sync with worker LLM_MODEL_SHORTCUTS). */
export const LLM_MODEL_SHORTCUTS: Record<string, string> = {
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4o": "openai/gpt-4o",
  "claude-sonnet": "anthropic/claude-sonnet-4-20250514",
  "claude-haiku": "anthropic/claude-3-5-haiku-latest",
  "minimax-free": "zencode/minimax-m2.5-free",
  "minimax-m2.5": "minimax/minimax-m2.5-free",
};

/** Keep in sync with apps/worker/src/lib/llm-providers.js */
export const AGENT_PROVIDER_OPTIONS: AgentProviderOption[] = [
  // Local/custom providers not available on models.dev:
  {
    id: "ollama",
    label: "Ollama (local)",
    models: [],
    allowCustomBaseUrl: true,
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    models: [],
    allowCustomBaseUrl: true,
  },
  {
    id: "cloudflare-ai-gateway",
    label: "Cloudflare AI Gateway",
    models: [],
    allowCustomBaseUrl: true,
    hint: "CLOUDFLARE_AI_GATEWAY_BASE_URL",
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    models: [],
    allowCustomBaseUrl: true,
  },
] as const;

const REGISTRY_IDS = new Set(AGENT_PROVIDER_OPTIONS.map((p) => p.id));

export function expandModelShortcut(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  return LLM_MODEL_SHORTCUTS[trimmed] || LLM_MODEL_SHORTCUTS[trimmed.toLowerCase()] || trimmed;
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
  let modelRaw = expandModelShortcut(modelField.trim());

  if (!providerId && modelRaw.includes("/")) {
    const expanded = expandModelShortcut(modelRaw);
    if (expanded.includes("/")) modelRaw = expanded;
  }

  if (modelRaw.includes("/")) {
    const slashIdx = modelRaw.indexOf("/");
    const prefix = modelRaw.slice(0, slashIdx).toLowerCase();
    const rest = modelRaw.slice(slashIdx + 1);
    if (REGISTRY_IDS.has(prefix) && (!providerId || providerId === prefix)) {
      providerId = prefix;
      const keepSlash =
        prefix === "openrouter" || prefix === "together" || prefix === "fireworks";
      if (!keepSlash) {
        modelRaw = rest;
      }
    }
  }

  if (!providerId) providerId = "openai";

  const modelId =
    modelRaw ||
    modelsForProvider(providerId)[0] ||
    (providerId === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o-mini");

  return {
    providerId,
    modelId,
    modelRef: formatModelRef(providerId, modelId),
  };
}

export function formatModelRef(providerId: string, modelId: string): string {
  if (providerId === "openrouter" || providerId === "together" || providerId === "fireworks") {
    return modelId.includes("/") ? modelId : `${providerId}/${modelId}`;
  }
  if (modelId.includes("/")) {
    const prefix = modelId.split("/")[0].toLowerCase();
    if (prefix === providerId) return modelId;
  }
  return `${providerId}/${modelId}`;
}

export function normalizeAgentLlmFields(provider: string, model: string) {
  return parseModelRef(provider, model);
}

export function modelsForProvider(provider: string): string[] {
  const match = AGENT_PROVIDER_OPTIONS.find((p) => p.id === provider);
  return match ? [...match.models] : [];
}

export function modelSuggestionsForProvider(provider: string): string[] {
  const presets = modelsForProvider(provider);
  const shortcuts = Object.entries(LLM_MODEL_SHORTCUTS)
    .filter(([, ref]) => ref.startsWith(`${provider}/`) || ref.split("/")[0] === provider)
    .map(([alias, ref]) => alias);
  return [...new Set([...shortcuts, ...presets, ...Object.values(LLM_MODEL_SHORTCUTS)])];
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

