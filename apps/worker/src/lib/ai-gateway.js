/**
 * Cloudflare AI Gateway transport (P12-I).
 * Falls back to legacy AI_BASE_URL when gateway env is unset.
 */
import { logInfo } from "./worker-log.js";

const GATEWAY_HOST = "https://gateway.ai.cloudflare.com";

/** Strip trailing slashes without regex (avoids ReDoS on hostile URLs). */
function trimTrailingSlashes(url) {
  let out = url;
  while (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

/**
 * @param {*} env
 */
export function isAiGatewayEnabled(env) {
  if (env.AI_GATEWAY_ENABLED === "false" || env.AI_GATEWAY_ENABLED === "0") {
    return false;
  }
  if (env.AI_GATEWAY_URL?.trim()) return true;
  return Boolean(env.AI_GATEWAY_ACCOUNT_ID?.trim() && env.AI_GATEWAY_ID?.trim());
}

/**
 * @param {*} env
 */
export function isAiConfigured(env) {
  return resolveAiTransport(env).configured;
}

/**
 * @param {*} env
 * @returns {{
 *   mode: "gateway" | "direct",
 *   configured: boolean,
 *   openAiCompatBase: string | null,
 *   chatCompletionsUrl: string | null,
 *   transcriptionsUrl: string | null,
 *   embeddingsUrl: string | null,
 *   anthropicMessagesUrl: string | null,
 * }}
 */
export function resolveAiTransport(env) {
  const provider = String(env.AI_GATEWAY_PROVIDER || "openai").trim() || "openai";
  const gatewayUrl = env.AI_GATEWAY_URL?.trim();

  if (isAiGatewayEnabled(env)) {
    const openAiCompatBase = gatewayUrl
      ? trimTrailingSlashes(gatewayUrl)
      : `${GATEWAY_HOST}/v1/${env.AI_GATEWAY_ACCOUNT_ID.trim()}/${env.AI_GATEWAY_ID.trim()}/${provider}`;
    return {
      mode: "gateway",
      configured: true,
      openAiCompatBase,
      chatCompletionsUrl: `${openAiCompatBase}/chat/completions`,
      transcriptionsUrl: `${openAiCompatBase}/audio/transcriptions`,
      embeddingsUrl: `${openAiCompatBase}/embeddings`,
      anthropicMessagesUrl: anthropicMessagesUrlFromGateway(env, openAiCompatBase),
    };
  }

  const legacy = env.AI_BASE_URL?.trim();
  if (!legacy) {
    return {
      mode: "direct",
      configured: false,
      openAiCompatBase: null,
      chatCompletionsUrl: null,
      transcriptionsUrl: null,
      embeddingsUrl: null,
      anthropicMessagesUrl: null,
    };
  }

  const normalized = trimTrailingSlashes(legacy);
  const openAiCompatBase = normalized.endsWith("/v1")
    ? normalized
    : `${normalized}/v1`;

  return {
    mode: "direct",
    configured: true,
    openAiCompatBase,
    chatCompletionsUrl: `${openAiCompatBase}/chat/completions`,
    transcriptionsUrl: `${openAiCompatBase}/audio/transcriptions`,
    embeddingsUrl: `${openAiCompatBase}/embeddings`,
    anthropicMessagesUrl: null,
  };
}

function anthropicMessagesUrlFromGateway(env, openAiCompatBase) {
  if (env.AI_GATEWAY_ACCOUNT_ID?.trim() && env.AI_GATEWAY_ID?.trim()) {
    return `${GATEWAY_HOST}/v1/${env.AI_GATEWAY_ACCOUNT_ID.trim()}/${env.AI_GATEWAY_ID.trim()}/anthropic/v1/messages`;
  }
  const base = trimTrailingSlashes(openAiCompatBase || "");
  if (base.endsWith("/openai")) {
    return `${base.slice(0, -"/openai".length)}/anthropic/v1/messages`;
  }
  if (base.endsWith("/anthropic")) {
    return `${base}/v1/messages`;
  }
  return `${base}/anthropic/v1/messages`;
}

/**
 * @param {*} env
 * @param {{
 *   metadata?: Record<string, unknown>,
 *   contentType?: string,
 *   extra?: Record<string, string>,
 * }} [options]
 */
export function buildAiAuthHeaders(env, options = {}) {
  const transport = resolveAiTransport(env);
  const headers = {
    ...(options.contentType ? { "Content-Type": options.contentType } : {}),
    ...(options.extra || {}),
  };

  const gatewayToken =
    env.AI_GATEWAY_TOKEN?.trim() ||
    env.CLOUDFLARE_API_TOKEN?.trim() ||
    env.CF_API_TOKEN?.trim();
  const providerKey =
    env.AI_GATEWAY_PROVIDER_KEY?.trim() || env.AI_API_KEY?.trim();

  if (transport.mode === "gateway") {
    if (gatewayToken) {
      headers.Authorization = `Bearer ${gatewayToken}`;
    } else if (providerKey) {
      headers.Authorization = `Bearer ${providerKey}`;
    }
    if (providerKey && gatewayToken) {
      headers["cf-aig-authorization"] = `Bearer ${providerKey}`;
    }
    const cacheTtl = env.AI_GATEWAY_CACHE_TTL?.trim();
    if (cacheTtl) {
      headers["cf-aig-cache-ttl"] = cacheTtl;
    }
    if (options.metadata && Object.keys(options.metadata).length) {
      headers["cf-aig-metadata"] = JSON.stringify(options.metadata).slice(0, 1024);
    }
  } else if (providerKey) {
    headers.Authorization = `Bearer ${providerKey}`;
  }

  return headers;
}

/**
 * Gateway overrides for agent LLM connections (openai-compatible worker fallback).
 * @param {*} env
 * @param {{ projectId?: string | null, useGateway?: boolean, feature?: string }} options
 */
export function getAiGatewayConnectionOverrides(env, options = {}) {
  if (!options.useGateway || !isAiGatewayEnabled(env)) {
    return {};
  }
  const transport = resolveAiTransport(env);
  if (transport.mode !== "gateway" || !transport.chatCompletionsUrl) {
    return {};
  }
  return {
    chatCompletionsUrl: transport.chatCompletionsUrl,
    anthropicMessagesUrl: transport.anthropicMessagesUrl || null,
    gatewayHeaders: buildAiAuthHeaders(env, {
      metadata: {
        ...(options.projectId ? { projectId: options.projectId } : {}),
        feature: options.feature || "agent",
      },
    }),
  };
}

/**
 * Resolve a dedicated transport for embeddings (may differ from the main LLM transport).
 * When AI_EMBEDDINGS_BASE_URL is set it takes priority; otherwise falls back to the
 * main AI transport (gateway or direct).
 *
 * @param {*} env
 * @returns {{ configured: boolean, embeddingsUrl: string | null }}
 */
export function resolveEmbeddingsTransport(env) {
  const dedicatedUrl = env.AI_EMBEDDINGS_BASE_URL?.trim();
  if (dedicatedUrl) {
    const normalized = trimTrailingSlashes(dedicatedUrl);
    const base = normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
    return { configured: true, embeddingsUrl: `${base}/embeddings` };
  }

  const main = resolveAiTransport(env);
  return { configured: main.configured, embeddingsUrl: main.embeddingsUrl };
}

/**
 * Build auth headers for the dedicated embeddings transport.
 * Uses AI_EMBEDDINGS_API_KEY when set, otherwise falls back to main AI auth.
 *
 * @param {*} env
 * @param {{ metadata?: Record<string, unknown>, contentType?: string }} [options]
 */
export function buildEmbeddingsAuthHeaders(env, options = {}) {
  const dedicatedKey = env.AI_EMBEDDINGS_API_KEY?.trim();
  if (dedicatedKey) {
    const headers = {
      ...(options.contentType ? { "Content-Type": options.contentType } : {}),
      Authorization: `Bearer ${dedicatedKey}`,
    };
    return headers;
  }
  return buildAiAuthHeaders(env, options);
}

/**
 * Resolve a dedicated transport for transcription (may differ from the main LLM transport).
 * When AI_TRANSCRIBE_BASE_URL is set it takes priority; otherwise falls back to the
 * main AI transport (gateway or direct).
 *
 * @param {*} env
 * @returns {{ configured: boolean, transcriptionsUrl: string | null, mode: string }}
 */
export function resolveTranscriptionTransport(env) {
  const dedicatedUrl = env.AI_TRANSCRIBE_BASE_URL?.trim();
  if (dedicatedUrl) {
    const normalized = trimTrailingSlashes(dedicatedUrl);
    const base = normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
    return { configured: true, transcriptionsUrl: `${base}/audio/transcriptions`, mode: "dedicated" };
  }

  const main = resolveAiTransport(env);
  return { configured: main.configured, transcriptionsUrl: main.transcriptionsUrl, mode: main.mode };
}

/**
 * Build auth headers for the dedicated transcription transport.
 * Uses AI_TRANSCRIBE_API_KEY when set, otherwise falls back to main AI auth.
 *
 * @param {*} env
 * @param {{ metadata?: Record<string, unknown>, contentType?: string, extra?: Record<string, string> }} [options]
 */
export function buildTranscriptionAuthHeaders(env, options = {}) {
  const dedicatedKey = env.AI_TRANSCRIBE_API_KEY?.trim();
  if (dedicatedKey) {
    const headers = {
      ...(options.contentType ? { "Content-Type": options.contentType } : {}),
      ...(options.extra || {}),
      Authorization: `Bearer ${dedicatedKey}`,
    };
    return headers;
  }
  return buildAiAuthHeaders(env, options);
}

/**
 * Resolve a dedicated transport for image generation (may differ from the main LLM transport).
 * When AI_IMAGE_BASE_URL is set it takes priority; otherwise falls back to the
 * main AI transport.
 *
 * @param {*} env
 * @returns {{ configured: boolean, imagesUrl: string | null, headers: Record<string, string> }}
 */
export function resolveImageTransport(env) {
  const dedicatedUrl = env.AI_IMAGE_BASE_URL?.trim();
  if (dedicatedUrl) {
    const normalized = trimTrailingSlashes(dedicatedUrl);
    const base = normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
    const dedicatedKey = env.AI_IMAGE_API_KEY?.trim() || env.AI_API_KEY?.trim() || "";
    return {
      configured: true,
      imagesUrl: `${base}/images/generations`,
      headers: dedicatedKey ? { Authorization: `Bearer ${dedicatedKey}` } : {},
    };
  }

  const baseUrl = env.AI_BASE_URL?.trim();
  if (!baseUrl) {
    return { configured: false, imagesUrl: null, headers: {} };
  }
  const normalized = trimTrailingSlashes(baseUrl);
  const base = normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
  const apiKey = env.AI_API_KEY || "";
  return {
    configured: true,
    imagesUrl: `${base}/images/generations`,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  };
}

/**
 * @param {*} env
 * @param {{ projectId?: string, feature?: string }} [context]
 */
export function logAiTransportOnce(env, context = {}) {
  const transport = resolveAiTransport(env);
  if (!transport.configured) return;
  logInfo("ai.transport", {
    mode: transport.mode,
    feature: context.feature || "unknown",
    projectId: context.projectId,
  });
}
