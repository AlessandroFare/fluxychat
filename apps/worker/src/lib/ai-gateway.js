/**
 * Cloudflare AI Gateway transport (P12-I).
 * Falls back to legacy AI_BASE_URL when gateway env is unset.
 */
import { logInfo } from "./worker-log.js";

const GATEWAY_HOST = "https://gateway.ai.cloudflare.com";

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
 * }}
 */
export function resolveAiTransport(env) {
  const provider = String(env.AI_GATEWAY_PROVIDER || "openai").trim() || "openai";
  const gatewayUrl = env.AI_GATEWAY_URL?.trim();

  if (isAiGatewayEnabled(env)) {
    const openAiCompatBase = gatewayUrl
      ? gatewayUrl.replace(/\/+$/, "")
      : `${GATEWAY_HOST}/v1/${env.AI_GATEWAY_ACCOUNT_ID.trim()}/${env.AI_GATEWAY_ID.trim()}/${provider}`;
    return {
      mode: "gateway",
      configured: true,
      openAiCompatBase,
      chatCompletionsUrl: `${openAiCompatBase}/chat/completions`,
      transcriptionsUrl: `${openAiCompatBase}/audio/transcriptions`,
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
    };
  }

  const normalized = legacy.replace(/\/+$/, "");
  const openAiCompatBase = normalized.endsWith("/v1")
    ? normalized
    : `${normalized}/v1`;

  return {
    mode: "direct",
    configured: true,
    openAiCompatBase,
    chatCompletionsUrl: `${openAiCompatBase}/chat/completions`,
    transcriptionsUrl: `${openAiCompatBase}/audio/transcriptions`,
  };
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
    gatewayHeaders: buildAiAuthHeaders(env, {
      metadata: {
        ...(options.projectId ? { projectId: options.projectId } : {}),
        feature: options.feature || "agent",
      },
    }),
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
