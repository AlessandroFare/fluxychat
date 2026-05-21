/**
 * LLM provider registry (OpenCode-inspired + AI SDK capability matrix).
 * - Model refs: `providerID/modelID` or shortcuts (see LLM_MODEL_SHORTCUTS)
 * - `anthropic`: native Messages API
 * - `openai-compatible`: Chat Completions (OpenAI, MiniMax, Groq, OpenRouter, gateways, …)
 * @see https://ai-sdk.dev/docs/foundations/providers-and-models
 */

import { buildModelCatalogEntry, fetchLiveOpenRouterModels } from "./llm-model-catalog.js";
import { getProjectLlmCredential } from "./project-llm-credentials.js";
import { workerSharedLlmAllowed } from "./hosted-saas-policy.js";

/** @typedef {"anthropic" | "openai-compatible"} LlmApiStyle */

/**
 * @typedef {object} LlmProviderDef
 * @property {string} label
 * @property {LlmApiStyle} apiStyle
 * @property {string} defaultBaseUrl
 * @property {string|null} apiKeyEnv
 * @property {string|null} [baseUrlEnv]
 * @property {string[]} [models]
 * @property {boolean} supportsStreaming
 * @property {boolean} supportsTools
 * @property {boolean} [allowCustomBaseUrl]
 * @property {boolean} [preserveSlashModelId]
 * @property {string} [docsUrl]
 */

/** @type {Record<string, LlmProviderDef>} */
export const LLM_PROVIDER_REGISTRY = {
  openai: {
    label: "OpenAI",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.openai.com",
    apiKeyEnv: "AI_API_KEY",
    baseUrlEnv: "AI_BASE_URL",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o3-mini"],
    supportsStreaming: true,
    supportsTools: true,
    docsUrl: "https://platform.openai.com/docs",
  },
  anthropic: {
    label: "Anthropic",
    apiStyle: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: [
      "claude-3-5-haiku-latest",
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-latest",
    ],
    supportsStreaming: false,
    supportsTools: true,
    docsUrl: "https://docs.anthropic.com",
  },
  minimax: {
    label: "MiniMax",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.minimaxi.com/v1",
    apiKeyEnv: "MINIMAX_API_KEY",
    baseUrlEnv: "MINIMAX_BASE_URL",
    models: ["minimax-m2.5-free", "MiniMax-Text-01", "abab6.5s-chat"],
    supportsStreaming: true,
    supportsTools: true,
    allowCustomBaseUrl: true,
    docsUrl: "https://platform.minimaxi.com",
  },
  zencode: {
    label: "ZenCode (gateway)",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "",
    apiKeyEnv: "ZENCODE_API_KEY",
    baseUrlEnv: "ZENCODE_BASE_URL",
    models: ["minimax-m2.5-free"],
    supportsStreaming: true,
    supportsTools: true,
    allowCustomBaseUrl: true,
    docsUrl: "https://zencode.ai",
  },
  openrouter: {
    label: "OpenRouter",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    baseUrlEnv: "OPENROUTER_BASE_URL",
    models: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-4", "google/gemini-2.0-flash"],
    supportsStreaming: true,
    supportsTools: true,
    allowCustomBaseUrl: true,
    preserveSlashModelId: true,
    docsUrl: "https://openrouter.ai/docs",
  },
  groq: {
    label: "Groq",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    supportsStreaming: true,
    supportsTools: true,
    docsUrl: "https://console.groq.com/docs",
  },
  deepseek: {
    label: "DeepSeek",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat", "deepseek-reasoner"],
    supportsStreaming: true,
    supportsTools: true,
    docsUrl: "https://api-docs.deepseek.com",
  },
  together: {
    label: "Together AI",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.together.xyz/v1",
    apiKeyEnv: "TOGETHER_API_KEY",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
    supportsStreaming: true,
    supportsTools: true,
    preserveSlashModelId: true,
    docsUrl: "https://docs.together.ai",
  },
  fireworks: {
    label: "Fireworks AI",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    apiKeyEnv: "FIREWORKS_API_KEY",
    models: ["accounts/fireworks/models/llama-v3p3-70b-instruct"],
    supportsStreaming: true,
    supportsTools: true,
    preserveSlashModelId: true,
    docsUrl: "https://docs.fireworks.ai",
  },
  cerebras: {
    label: "Cerebras",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    apiKeyEnv: "CEREBRAS_API_KEY",
    models: ["llama-3.3-70b"],
    supportsStreaming: true,
    supportsTools: false,
    docsUrl: "https://inference-docs.cerebras.ai",
  },
  mistral: {
    label: "Mistral",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    apiKeyEnv: "MISTRAL_API_KEY",
    models: ["mistral-small-latest", "mistral-large-latest"],
    supportsStreaming: true,
    supportsTools: true,
    docsUrl: "https://docs.mistral.ai",
  },
  xai: {
    label: "xAI (Grok)",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.x.ai/v1",
    apiKeyEnv: "XAI_API_KEY",
    models: ["grok-2-latest", "grok-beta"],
    supportsStreaming: true,
    supportsTools: true,
    docsUrl: "https://docs.x.ai",
  },
  moonshot: {
    label: "Moonshot AI",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    apiKeyEnv: "MOONSHOT_API_KEY",
    models: ["moonshot-v1-8k", "moonshot-v1-32k"],
    supportsStreaming: true,
    supportsTools: true,
    docsUrl: "https://platform.moonshot.cn",
  },
  ollama: {
    label: "Ollama (local)",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    apiKeyEnv: null,
    baseUrlEnv: "OLLAMA_BASE_URL",
    models: ["llama3.2", "qwen2.5", "mistral"],
    supportsStreaming: true,
    supportsTools: false,
    allowCustomBaseUrl: true,
    docsUrl: "https://ollama.com",
  },
  lmstudio: {
    label: "LM Studio (local)",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
    apiKeyEnv: null,
    baseUrlEnv: "LMSTUDIO_BASE_URL",
    models: [],
    supportsStreaming: true,
    supportsTools: false,
    allowCustomBaseUrl: true,
    docsUrl: "https://lmstudio.ai",
  },
  "cloudflare-ai-gateway": {
    label: "Cloudflare AI Gateway",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "",
    apiKeyEnv: "CLOUDFLARE_AI_GATEWAY_API_KEY",
    baseUrlEnv: "CLOUDFLARE_AI_GATEWAY_BASE_URL",
    models: [],
    supportsStreaming: true,
    supportsTools: true,
    allowCustomBaseUrl: true,
    docsUrl: "https://developers.cloudflare.com/ai-gateway/",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    apiStyle: "openai-compatible",
    defaultBaseUrl: "",
    apiKeyEnv: "AI_API_KEY",
    baseUrlEnv: "AI_BASE_URL",
    models: [],
    supportsStreaming: true,
    supportsTools: true,
    allowCustomBaseUrl: true,
  },
};

/**
 * Shortcuts → full `provider/model` ref (OpenCode-style).
 * @type {Record<string, string>}
 */
export const LLM_MODEL_SHORTCUTS = {
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4o": "openai/gpt-4o",
  "claude-sonnet": "anthropic/claude-sonnet-4-20250514",
  "claude-haiku": "anthropic/claude-3-5-haiku-latest",
  "minimax-free": "zencode/minimax-m2.5-free",
  "minimax-m2.5": "minimax/minimax-m2.5-free",
};

const MODEL_PROVIDER_HINTS = {
  "gpt-": "openai",
  "o1": "openai",
  "o3": "openai",
  claude: "anthropic",
  minimax: "minimax",
  deepseek: "deepseek",
  grok: "xai",
  moonshot: "moonshot",
  mistral: "mistral",
  llama: "groq",
};

const PROVIDERS_KEEPING_SLASH_MODEL = new Set(
  Object.entries(LLM_PROVIDER_REGISTRY)
    .filter(([, def]) => def.preserveSlashModelId)
    .map(([id]) => id)
);

function readEnv(env, key) {
  if (!key) return "";
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(url) {
  if (!url) return "";
  return url.replace(/\/$/, "");
}

/**
 * Expand shortcut aliases to a full model reference string.
 * @param {string} input
 */
export function expandModelShortcut(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return trimmed;
  return LLM_MODEL_SHORTCUTS[trimmed] || LLM_MODEL_SHORTCUTS[trimmed.toLowerCase()] || trimmed;
}

/**
 * Parse OpenCode-style `providerID/modelID` (supports multi-segment model ids for OpenRouter).
 * @param {string|null|undefined} providerField
 * @param {string|null|undefined} modelField
 * @returns {{ providerId: string, modelId: string, modelRef: string }}
 */
export function parseModelRef(providerField, modelField) {
  let providerId = String(providerField || "").trim().toLowerCase();
  let modelRaw = expandModelShortcut(String(modelField || "").trim());

  if (modelRaw.includes("/")) {
    const combined = expandModelShortcut(modelRaw);
    if (combined !== modelRaw && combined.includes("/")) {
      modelRaw = combined;
    }
  } else if (!providerId && modelRaw) {
    const fromShortcut = expandModelShortcut(modelRaw);
    if (fromShortcut.includes("/")) {
      modelRaw = fromShortcut;
    }
  }

  if (providerId && modelRaw.includes("/")) {
    const prefix = modelRaw.split("/")[0].toLowerCase();
    if (prefix === providerId && LLM_PROVIDER_REGISTRY[providerId]?.preserveSlashModelId) {
      return {
        providerId,
        modelId: modelRaw,
        modelRef: formatModelRef(providerId, modelRaw),
      };
    }
  }

  if (modelRaw.includes("/")) {
    const slashIdx = modelRaw.indexOf("/");
    const prefix = modelRaw.slice(0, slashIdx).toLowerCase();
    const rest = modelRaw.slice(slashIdx + 1);

    if (LLM_PROVIDER_REGISTRY[prefix]) {
      const def = LLM_PROVIDER_REGISTRY[prefix];
      if (def.preserveSlashModelId) {
        return {
          providerId: prefix,
          modelId: modelRaw,
          modelRef: formatModelRef(prefix, modelRaw),
        };
      }
      if (!providerId || providerId === prefix) {
        providerId = prefix;
        modelRaw = rest;
      }
    } else if (!providerId) {
      providerId = prefix;
      modelRaw = rest;
    }
  }

  if (!providerId && modelRaw) {
    const lower = modelRaw.toLowerCase();
    for (const [hint, prov] of Object.entries(MODEL_PROVIDER_HINTS)) {
      if (lower.startsWith(hint) || lower.includes(hint)) {
        providerId = prov;
        break;
      }
    }
  }

  if (!providerId) providerId = "openai";

  const def = LLM_PROVIDER_REGISTRY[providerId];
  let modelId = modelRaw;
  if (def?.preserveSlashModelId && modelRaw.includes("/") && !modelRaw.startsWith(`${providerId}/`)) {
    modelId = modelRaw;
  }

  return {
    providerId,
    modelId: modelId || (def?.models?.[0] ?? "gpt-4o-mini"),
    modelRef: formatModelRef(providerId, modelId),
  };
}

/**
 * @param {string} providerId
 * @param {string} modelId
 */
export function formatModelRef(providerId, modelId) {
  if (!providerId) return modelId;
  if (PROVIDERS_KEEPING_SLASH_MODEL.has(providerId)) {
    return modelId.includes("/") ? modelId : `${providerId}/${modelId}`;
  }
  if (modelId.includes("/")) {
    const prefix = modelId.split("/")[0].toLowerCase();
    if (prefix === providerId) {
      return modelId;
    }
  }
  return `${providerId}/${modelId}`;
}

/**
 * Normalize agent body fields before persistence.
 * @param {string|null|undefined} provider
 * @param {string|null|undefined} model
 */
export function normalizeAgentLlmFields(provider, model) {
  const parsed = parseModelRef(provider, model);
  return {
    provider: parsed.providerId,
    model: parsed.modelId,
    modelRef: parsed.modelRef,
  };
}

/**
 * @param {unknown} config
 * @returns {{ baseUrl?: string, apiKeyEnv?: string, apiStyle?: LlmApiStyle }}
 */
export function parseAgentLlmConfig(config) {
  if (!config || typeof config !== "object") return {};
  const root = /** @type {Record<string, unknown>} */ (config);
  const llm = root.llm;
  if (!llm || typeof llm !== "object") return {};
  const o = /** @type {Record<string, unknown>} */ (llm);
  return {
    baseUrl: typeof o.baseUrl === "string" ? o.baseUrl.trim() : undefined,
    apiKeyEnv: typeof o.apiKeyEnv === "string" ? o.apiKeyEnv.trim() : undefined,
    apiStyle:
      o.apiStyle === "anthropic" || o.apiStyle === "openai-compatible"
        ? o.apiStyle
        : undefined,
    fallbackProvider:
      typeof o.fallbackProvider === "string" ? o.fallbackProvider.trim() : undefined,
    fallbackModel: typeof o.fallbackModel === "string" ? o.fallbackModel.trim() : undefined,
  };
}

/**
 * @param {Record<string, string>} env
 * @param {{ provider?: string|null, model?: string|null, config?: unknown, projectId?: string|null }} params
 */
export async function resolveLlmConnection(env, { provider: providerField, model: modelField, config, projectId }) {
  const agentLlm = parseAgentLlmConfig(config);
  const { providerId: id, modelId } = parseModelRef(providerField, modelField);

  const def = LLM_PROVIDER_REGISTRY[id] || LLM_PROVIDER_REGISTRY.custom;
  const apiStyle = agentLlm.apiStyle || def.apiStyle;

  let projectCred = null;
  if (projectId && env.DB) {
    projectCred = await getProjectLlmCredential(env, projectId, id);
  }

  let baseUrl =
    projectCred?.baseUrl ||
    agentLlm.baseUrl ||
    readEnv(env, def.baseUrlEnv) ||
    def.defaultBaseUrl;

  if (!baseUrl && id === "openai") {
    baseUrl = readEnv(env, "AI_BASE_URL") || def.defaultBaseUrl || "https://api.openai.com";
  } else if (!baseUrl && apiStyle === "openai-compatible" && !def.allowCustomBaseUrl) {
    baseUrl = readEnv(env, "AI_BASE_URL") || def.defaultBaseUrl || "https://api.openai.com";
  }

  baseUrl = normalizeBaseUrl(baseUrl);

  const apiKeyEnv = agentLlm.apiKeyEnv || def.apiKeyEnv;
  const sharedLlmOk = workerSharedLlmAllowed(env, projectId);
  let apiKey = projectCred?.apiKey || (sharedLlmOk ? readEnv(env, apiKeyEnv) : null);
  if (!apiKey && apiStyle === "openai-compatible" && sharedLlmOk) {
    apiKey = readEnv(env, "AI_API_KEY");
  }

  const resolvedModel =
    modelId ||
    (def.models && def.models.length ? def.models[0] : null) ||
    (apiStyle === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o-mini");

  const needsBaseUrl = def.allowCustomBaseUrl || id === "custom" || id === "zencode";
  if (apiStyle === "openai-compatible" && needsBaseUrl && !baseUrl) {
    return {
      ok: false,
      error: `provider_${id}_requires_base_url`,
      hint:
        id === "zencode"
          ? "Set ZENCODE_BASE_URL or agent config.llm.baseUrl to your ZenCode OpenAI-compatible endpoint."
          : "Set config.llm.baseUrl on the agent or the provider BASE_URL env var.",
    };
  }

  if (apiStyle === "anthropic" && !apiKey) {
    return {
      ok: false,
      error: "anthropic_api_key_missing",
      hint: "Set ANTHROPIC_API_KEY on the Worker.",
    };
  }

  return {
    ok: true,
    providerId: id,
    label: def.label,
    apiStyle,
    baseUrl,
    apiKey,
    model: resolvedModel,
    modelRef: formatModelRef(id, resolvedModel),
    supportsStreaming: def.supportsStreaming && apiStyle === "openai-compatible",
    supportsTools: def.supportsTools,
    apiKeyConfigured: !!apiKey,
    apiKeySource: projectCred?.apiKey ? "project" : apiKey ? "worker" : "none",
  };
}

/**
 * @param {Record<string, string>} env
 * @param {{ provider?: string|null, model?: string|null, config?: unknown, projectId?: string|null }} primary
 */
export async function resolveLlmConnectionWithFallback(env, primary) {
  const main = await resolveLlmConnection(env, primary);
  if (!main.ok) return { primary: main, fallback: null };

  const agentLlm = parseAgentLlmConfig(primary.config);
  if (agentLlm.fallbackProvider) {
    let fallback = await resolveLlmConnection(env, {
      provider: agentLlm.fallbackProvider,
      model: agentLlm.fallbackModel || null,
      config: primary.config,
      projectId: primary.projectId,
    });
    if (fallback && !fallback.ok) fallback = null;
    return { primary: main, fallback };
  }

  let fallback = null;
  const sharedLlmOk = workerSharedLlmAllowed(env, primary.projectId);
  if (main.apiStyle === "anthropic" && sharedLlmOk && readEnv(env, "AI_API_KEY")) {
    fallback = await resolveLlmConnection(env, {
      provider: "openai",
      model: "gpt-4o-mini",
      config: primary.config,
      projectId: primary.projectId,
    });
  } else if (main.apiStyle === "openai-compatible" && sharedLlmOk && readEnv(env, "ANTHROPIC_API_KEY")) {
    fallback = await resolveLlmConnection(env, {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      config: null,
      projectId: primary.projectId,
    });
  }

  if (fallback && !fallback.ok) fallback = null;
  return { primary: main, fallback };
}

function envHasWorkerKey(env, def) {
  if (def.apiKeyEnv && readEnv(env, def.apiKeyEnv)) return true;
  if (def.apiStyle === "openai-compatible" && readEnv(env, "AI_API_KEY")) return true;
  return false;
}

/**
 * Public catalog for dashboard (no secrets).
 * @param {Record<string, string>} env
 * @param {{ projectId?: string|null, live?: boolean, projectCredentials?: Array<{ providerId: string, hasApiKey: boolean, baseUrl?: string|null }> }} [options]
 */
export async function listLlmProvidersForApi(env, options = {}) {
  const credByProvider = new Map(
    (options.projectCredentials || []).map((c) => [c.providerId, c])
  );

  const providers = Object.entries(LLM_PROVIDER_REGISTRY).map(([id, def]) => {
    const projectCred = credByProvider.get(id);
    const models = (def.models || []).map((modelId) =>
      buildModelCatalogEntry(modelId, id, def.apiStyle)
    );

    return {
      id,
      label: def.label,
      apiStyle: def.apiStyle,
      models,
      supportsStreaming: def.supportsStreaming,
      supportsTools: def.supportsTools,
      allowCustomBaseUrl: !!def.allowCustomBaseUrl,
      preserveSlashModelId: !!def.preserveSlashModelId,
      docsUrl: def.docsUrl || null,
      credentialStatus: {
        project: projectCred?.hasApiKey ? "configured" : "missing",
        worker: envHasWorkerKey(env, def) ? "configured" : "missing",
        baseUrl: projectCred?.baseUrl || null,
      },
    };
  });

  const payload = {
    providers,
    shortcuts: Object.entries(LLM_MODEL_SHORTCUTS).map(([alias, modelRef]) => ({
      alias,
      modelRef,
      capabilities: getModelCapabilitiesFromRef(modelRef),
    })),
    capabilityLegend: {
      imageInput: "Accepts image input",
      objectGeneration: "Structured / JSON output",
      toolUsage: "Function calling",
      toolStreaming: "Streaming tool call deltas",
    },
    docsUrl: "https://ai-sdk.dev/docs/foundations/providers-and-models",
  };

  if (options.live && env) {
    const liveModels = await fetchLiveOpenRouterModels(env);
    if (liveModels?.length) {
      payload.liveModels = {
        source: "openrouter",
        fetchedAt: new Date().toISOString(),
        models: liveModels,
      };
    }
  }

  return payload;
}

/**
 * @param {string} modelRef
 */
function getModelCapabilitiesFromRef(modelRef) {
  const parsed = parseModelRef(null, modelRef);
  const def = LLM_PROVIDER_REGISTRY[parsed.providerId];
  return buildModelCatalogEntry(parsed.modelId, parsed.providerId, def?.apiStyle || "openai-compatible").capabilities;
}

export function isAnthropicConnection(connection) {
  return connection?.apiStyle === "anthropic";
}
