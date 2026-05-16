/**
 * Curated model capabilities (AI SDK-style matrix).
 * @see https://ai-sdk.dev/docs/foundations/providers-and-models
 */

/** @typedef {{ imageInput?: boolean, objectGeneration?: boolean, toolUsage?: boolean, toolStreaming?: boolean }} ModelCapabilities */

/** @type {Record<string, ModelCapabilities>} */
const MODEL_CAPABILITIES_BY_ID = {
  "gpt-4o": { imageInput: true, objectGeneration: true, toolUsage: true, toolStreaming: true },
  "gpt-4o-mini": { objectGeneration: true, toolUsage: true, toolStreaming: true },
  "gpt-4.1": { imageInput: true, objectGeneration: true, toolUsage: true, toolStreaming: true },
  "gpt-4.1-mini": { objectGeneration: true, toolUsage: true, toolStreaming: true },
  "o3-mini": { objectGeneration: true, toolUsage: true, toolStreaming: true },
  "claude-sonnet-4-20250514": { imageInput: true, objectGeneration: true, toolUsage: true, toolStreaming: false },
  "claude-3-5-haiku-latest": { objectGeneration: true, toolUsage: true, toolStreaming: false },
  "claude-3-5-sonnet-latest": { imageInput: true, objectGeneration: true, toolUsage: true, toolStreaming: false },
  "minimax-m2.5-free": { toolUsage: true, toolStreaming: true },
  "deepseek-chat": { toolUsage: true, toolStreaming: true },
  "deepseek-reasoner": { objectGeneration: true, toolUsage: true, toolStreaming: true },
  "llama-3.3-70b-versatile": { toolUsage: true, toolStreaming: true },
  "grok-2-latest": { toolUsage: true, toolStreaming: true },
  "mistral-large-latest": { toolUsage: true, toolStreaming: true },
};

const DEFAULT_OPENAI_COMPAT = {
  objectGeneration: true,
  toolUsage: true,
  toolStreaming: true,
};

const DEFAULT_ANTHROPIC = {
  imageInput: true,
  objectGeneration: true,
  toolUsage: true,
  toolStreaming: false,
};

/**
 * @param {string} modelId
 * @param {"anthropic"|"openai-compatible"} apiStyle
 * @returns {ModelCapabilities}
 */
export function getModelCapabilities(modelId, apiStyle) {
  const bare = String(modelId || "").split("/").pop() || modelId;
  if (MODEL_CAPABILITIES_BY_ID[bare]) {
    return { ...MODEL_CAPABILITIES_BY_ID[bare] };
  }
  if (MODEL_CAPABILITIES_BY_ID[modelId]) {
    return { ...MODEL_CAPABILITIES_BY_ID[modelId] };
  }
  return apiStyle === "anthropic"
    ? { ...DEFAULT_ANTHROPIC }
    : { ...DEFAULT_OPENAI_COMPAT };
}

/**
 * @param {string} modelId
 * @param {string} providerId
 * @param {"anthropic"|"openai-compatible"} apiStyle
 */
export function buildModelCatalogEntry(modelId, providerId, apiStyle) {
  return {
    id: modelId,
    providerId,
    capabilities: getModelCapabilities(modelId, apiStyle),
  };
}

const LIVE_CACHE_TTL_SEC = 6 * 60 * 60;

/**
 * Fetch OpenRouter public model list (optional enrichment).
 * @param {Record<string, string>} env
 */
export async function fetchLiveOpenRouterModels(env) {
  const cacheKey = "llm:openrouter:models:v1";
  if (env.RATE_LIMIT_KV) {
    try {
      const cached = await env.RATE_LIMIT_KV.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      /* ignore */
    }
  }

  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { "HTTP-Referer": "https://fluxychat.dev", "X-Title": "FluxyChat" },
  });
  if (!res.ok) return null;

  const body = await res.json();
  const data = Array.isArray(body?.data) ? body.data : [];

  const models = data
    .filter((m) => m?.id)
    .map((m) => ({
      id: String(m.id),
      name: m.name || m.id,
      providerId: "openrouter",
      contextLength: m.context_length ?? null,
      pricing: m.pricing
        ? {
            prompt: m.pricing.prompt,
            completion: m.pricing.completion,
          }
        : null,
      capabilities: {
        toolUsage: true,
        toolStreaming: true,
        objectGeneration: true,
      },
      source: "openrouter-live",
    }))
    .slice(0, 200);

  if (env.RATE_LIMIT_KV && models.length) {
    try {
      await env.RATE_LIMIT_KV.put(cacheKey, JSON.stringify(models), {
        expirationTtl: LIVE_CACHE_TTL_SEC,
      });
    } catch {
      /* ignore */
    }
  }

  return models;
}
