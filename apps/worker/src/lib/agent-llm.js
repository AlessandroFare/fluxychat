import { isAnthropicConnection } from "./llm-providers.js";
import {
  extractAnthropicToolCalls,
  extractOpenAIToolCalls,
} from "./agent-tool-calls.js";
import { logInfo } from "./worker-log.js";

export const MAX_TOOL_ITERATIONS = 5;

export async function callLlmOpenAI(baseUrl, apiKey, model, messages, tools, opts = {}) {
  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens || 1024,
    temperature: opts.temperature ?? 0.7,
  };
  if (tools && tools.length) body.tools = tools;
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
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
    opts
  );
}

export function extractLlmResponse(connection, response, registeredTools, runId) {
  const extracted = isAnthropicConnection(connection)
    ? extractAnthropicToolCalls(response, registeredTools, runId)
    : extractOpenAIToolCalls(response, registeredTools, runId);
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
