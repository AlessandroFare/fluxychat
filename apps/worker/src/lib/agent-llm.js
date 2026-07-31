import { buildOpenAiChatCompletionsUrl } from "./openai-compat-url.js";
import { isAnthropicConnection } from "./llm-providers.js";
import {
  extractAnthropicToolCalls,
  extractOpenAIToolCalls,
} from "./agent-tool-calls.js";
import { assertSafeOutboundUrl } from "./url-ssrf.js";
import { logInfo } from "./worker-log.js";

export const MAX_TOOL_ITERATIONS = 5;

export async function callLlmOpenAI(baseUrl, apiKey, model, messages, tools, opts = {}) {
  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens || 1024,
    temperature: opts.temperature ?? 0.7,
    ...(opts.topP !== undefined ? { top_p: opts.topP } : {}),
    ...(opts.frequencyPenalty !== undefined ? { frequency_penalty: opts.frequencyPenalty } : {}),
    ...(opts.presencePenalty !== undefined ? { presence_penalty: opts.presencePenalty } : {}),
    ...(opts.stopSequences ? { stop: opts.stopSequences.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
  };
  if (tools && tools.length) body.tools = tools;
  const url = buildOpenAiChatCompletionsUrl(baseUrl, opts.chatCompletionsUrl);
  const headers = {
    "Content-Type": "application/json",
    ...(opts.gatewayHeaders || {}),
  };
  if (
    apiKey &&
    !headers.Authorization &&
    !headers["cf-aig-authorization"]
  ) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  // SECURITY: SSRF_RESIDUAL  `url` is derived from `baseUrl`, which
  // comes from env.AI_BASE_URL (or a Cloudflare AI Gateway URL set by
  // the operator). It is NOT user-supplied per request. DNS rebinding
  // is the only residual concern because Workers cannot resolve DNS
  // before `fetch()`. We also assert the URL is not RFC1918 / loopback
  // at request time so a misconfigured env.AI_BASE_URL pointing at
  // 10.0.0.0/8 or 127.0.0.1 fails fast instead of silently probing the
  // worker's local network.
  assertSafeOutboundUrl(url);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function callLlmAnthropic(apiKey, model, messages, systemPrompt, tools, opts = {}) {
  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens || 1024,
    ...(systemPrompt ? { system: systemPrompt } : {}),
  };
  if (tools && tools.length) {
    body.tools = tools.map((t) => ({
      name: t.function?.name || t.name,
      description: t.function?.description || t.description || "",
      input_schema:
        t.function?.parameters || t.parameters || { type: "object", properties: {} },
    }));
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function callLlmForConnection(connection, messages, tools, systemPrompt, opts) {
  if (isAnthropicConnection(connection)) {
    const openAiStyleMessages = [];
    for (const m of messages) {
      if (m.role === "system") continue;
      openAiStyleMessages.push(m);
    }
    return callLlmAnthropic(
      connection.apiKey,
      connection.model,
      openAiStyleMessages,
      systemPrompt,
      tools,
      opts
    );
  }
  return callLlmOpenAI(
    connection.baseUrl,
    connection.apiKey,
    connection.model,
    messages,
    tools,
    {
      ...opts,
      chatCompletionsUrl: connection.chatCompletionsUrl,
      gatewayHeaders: connection.gatewayHeaders,
    },
  );
}

export function extractLlmResponse(connection, response, registeredTools, runId, projectAllowList = null, envAllowList = null) {
  const extracted = isAnthropicConnection(connection)
    ? extractAnthropicToolCalls(response, registeredTools, runId, projectAllowList, envAllowList)
    : extractOpenAIToolCalls(response, registeredTools, runId, projectAllowList, envAllowList);
  for (const warning of extracted.invalidWarnings || []) {
    logInfo(warning);
  }
  return extracted;
}

export function buildToolResultMessage(connection, toolCall, toolResult) {
  if (isAnthropicConnection(connection)) {
    return {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: toolResult.success
            ? JSON.stringify(toolResult.result)
            : `Error: ${toolResult.error}`,
        },
      ],
    };
  }
  return {
    role: "tool",
    tool_call_id: toolCall.id,
    content: toolResult.success
      ? JSON.stringify(toolResult.result)
      : `Error: ${toolResult.error}`,
  };
}

export function estimateCost(provider, model, inputTokens, outputTokens) {
  const pricing = {
    openai: {
      "gpt-4o": [2.5 / 1e6, 10 / 1e6],
      "gpt-4o-mini": [0.15 / 1e6, 0.6 / 1e6],
      default: [0.15 / 1e6, 0.6 / 1e6],
    },
    anthropic: {
      "claude-sonnet-4-20250514": [3 / 1e6, 15 / 1e6],
      default: [3 / 1e6, 15 / 1e6],
    },
  };
  const providerPricing = pricing[provider] || pricing.openai;
  const [inputPrice, outputPrice] =
    providerPricing[model] || providerPricing.default;
  return inputTokens * inputPrice + outputTokens * outputPrice;
}
