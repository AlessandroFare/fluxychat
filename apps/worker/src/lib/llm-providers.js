/**
 * LLM provider registry (OpenCode-inspired + AI SDK capability matrix).
 * - Model refs: `providerID/modelID` or shortcuts (see LLM_MODEL_SHORTCUTS)
 * - `anthropic`: native Messages API
 * - `openai-compatible`: Chat Completions (OpenAI, MiniMax, Groq, OpenRouter, gateways, …)
 * @see https://ai-sdk.dev/docs/foundations/providers-and-models
 */

import { buildModelCatalogEntry } from "./llm-model-catalog.js";
import { buildOpenAiChatCompletionsUrl } from "./openai-compat-url.js";
import { getProjectLlmCredential } from "./project-llm-credentials.js";
import { workerSharedLlmAllowed } from "./hosted-saas-policy.js";
import { getAiGatewayConnectionOverrides } from "./ai-gateway.js";

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

const PROVIDERS_KEEPING_SLASH_MODEL = new Set();

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
  return String(input || "").trim();
}

/**
 * Parse OpenCode-style `providerID/modelID` (supports multi-segment model ids for OpenRouter).
 * @param {string|null|undefined} providerField
 * @param {string|null|undefined} modelField
 * @returns {{ providerId: string, modelId: string, modelRef: string }}
 */
export function parseModelRef(providerField, modelField) {
  let providerId = String(providerField || "").trim().toLowerCase();
  let modelRaw = String(modelField || "").trim();

  if (modelRaw.includes("/") && !providerId) {
    providerId = modelRaw.split("/")[0].toLowerCase();
    modelRaw = modelRaw.slice(modelRaw.indexOf("/") + 1);
  }

  if (!providerId) providerId = "custom";

  return {
    providerId,
    modelId: modelRaw || "",
    modelRef: formatModelRef(providerId, modelRaw),
  };
}

/**
 * @param {string} providerId
 * @param {string} modelId
 */
export function formatModelRef(providerId, modelId) {
  if (!modelId) return providerId;
  if (modelId.includes("/")) {
    const prefix = modelId.split("/")[0].toLowerCase();
    if (prefix === providerId) return modelId;
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

  if (!baseUrl && apiStyle === "openai-compatible") {
    baseUrl = readEnv(env, "AI_BASE_URL") || def.defaultBaseUrl;
  }

  baseUrl = normalizeBaseUrl(baseUrl);

  const apiKeyEnv = agentLlm.apiKeyEnv || def.apiKeyEnv;
  const sharedLlmOk = workerSharedLlmAllowed(env, projectId);
  let apiKey = projectCred?.apiKey || (sharedLlmOk ? readEnv(env, apiKeyEnv) : null);
  if (!apiKey && apiStyle === "openai-compatible" && sharedLlmOk) {
    apiKey = readEnv(env, "AI_API_KEY");
  }

  const resolvedModel = modelId || "";

  if (!baseUrl && apiStyle === "openai-compatible") {
    return {
      ok: false,
      error: `provider_${id}_requires_base_url`,
      hint: "Set config.llm.baseUrl on the agent or configure a base URL via LLM keys.",
    };
  }

  const connection = {
    ok: true,
    providerId: id,
    label: def.label,
    apiStyle,
    baseUrl,
    apiKey,
    model: resolvedModel,
    modelRef: formatModelRef(id, resolvedModel),
    chatCompletionsUrl:
      apiStyle === "openai-compatible"
        ? buildOpenAiChatCompletionsUrl(baseUrl)
        : null,
    supportsStreaming: def.supportsStreaming && apiStyle === "openai-compatible",
    supportsTools: def.supportsTools,
    apiKeyConfigured: !!apiKey,
    apiKeySource: projectCred?.apiKey ? "project" : apiKey ? "worker" : "none",
  };

  const usingProjectOrAgentUrl = Boolean(projectCred?.baseUrl || agentLlm.baseUrl);
  if (sharedLlmOk && !usingProjectOrAgentUrl) {
    const gateway = getAiGatewayConnectionOverrides(env, {
      useGateway: true,
      projectId,
      feature: "agent",
    });
    if (gateway.chatCompletionsUrl || gateway.anthropicMessagesUrl) {
      if (apiStyle === "openai-compatible" && gateway.chatCompletionsUrl) {
        connection.chatCompletionsUrl = gateway.chatCompletionsUrl;
      }
      if (apiStyle === "anthropic" && gateway.anthropicMessagesUrl) {
        connection.anthropicMessagesUrl = gateway.anthropicMessagesUrl;
      }
      connection.gatewayHeaders = gateway.gatewayHeaders;
    }
  }

  return connection;
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

  return {
    providers,
    shortcuts: [],
    capabilityLegend: {},
    docsUrl: "",
  };
}

export function isAnthropicConnection(connection) {
  return connection?.apiStyle === "anthropic";
}
