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
  {
    id: "openai",
    label: "OpenAI",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o3-mini"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    models: ["claude-3-5-haiku-latest", "claude-sonnet-4-20250514"],
  },
  {
    id: "minimax",
    label: "MiniMax",
    models: ["minimax-m2.5-free", "MiniMax-Text-01", "abab6.5s-chat"],
    allowCustomBaseUrl: true,
    hint: "MINIMAX_API_KEY, optional MINIMAX_BASE_URL",
  },
  {
    id: "zencode",
    label: "ZenCode (gateway)",
    models: ["minimax-m2.5-free"],
    allowCustomBaseUrl: true,
    hint: "ZENCODE_API_KEY + ZENCODE_BASE_URL — or shortcut minimax-free",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    models: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-4", "google/gemini-2.0-flash"],
    allowCustomBaseUrl: true,
    hint: "Model field keeps vendor/id (e.g. openai/gpt-4o-mini)",
  },
  { id: "groq", label: "Groq", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
  { id: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  {
    id: "together",
    label: "Together AI",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    models: ["accounts/fireworks/models/llama-v3p3-70b-instruct"],
  },
  { id: "cerebras", label: "Cerebras", models: ["llama-3.3-70b"] },
  { id: "mistral", label: "Mistral", models: ["mistral-small-latest", "mistral-large-latest"] },
  { id: "xai", label: "xAI (Grok)", models: ["grok-2-latest"] },
  { id: "moonshot", label: "Moonshot AI", models: ["moonshot-v1-8k"] },
  {
    id: "ollama",
    label: "Ollama (local)",
    models: ["llama3.2", "qwen2.5"],
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

export function buildAgentLlmConfig(
  provider: string,
  baseUrl: string,
): { llm: { baseUrl: string } } | undefined {
  const trimmed = baseUrl.trim();
  if (!trimmed || !providerAllowsCustomBaseUrl(provider)) return undefined;
  return { llm: { baseUrl: trimmed } };
}

/** When user types a composite ref, sync provider + model fields. */
export function applyModelInput(provider: string, modelInput: string): {
  provider: string;
  model: string;
} {
  const parsed = parseModelRef(provider, modelInput);
  return { provider: parsed.providerId, model: parsed.modelId };
}
