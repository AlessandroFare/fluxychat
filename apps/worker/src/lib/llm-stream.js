/**
 * OpenAI-compatible chat/completions streaming (SSE).
 */
import { buildOpenAiChatCompletionsUrl } from "./openai-compat-url.js";
import { fetchWithDoKeepalive, outboundStreamTags } from "./do-outbound-keepalive.js";

/**
 * @param {unknown} parsed
 * @param {string} fullContent
 * @param {(delta: string, full: string) => void | Promise<void>} onDelta
 */
async function appendStreamContent(parsed, fullContent, onDelta) {
  const choice = parsed?.choices?.[0];
  if (!choice) return fullContent;

  const delta = choice.delta?.content;
  if (typeof delta === "string" && delta.length > 0) {
    const next = fullContent + delta;
    await onDelta(delta, next);
    return next;
  }

  const messageContent = choice.message?.content;
  if (typeof messageContent === "string" && messageContent.length > 0) {
    if (messageContent.startsWith(fullContent)) {
      const tail = messageContent.slice(fullContent.length);
      if (tail.length > 0) {
        const next = fullContent + tail;
        await onDelta(tail, next);
        return next;
      }
      return fullContent || messageContent;
    }
    if (!fullContent) {
      await onDelta(messageContent, messageContent);
      return messageContent;
    }
  }

  return fullContent;
}

/**
 * @param {string} line
 * @param {{ usage: { prompt_tokens?: number, completion_tokens?: number } }} state
 * @param {string} fullContent
 * @param {(delta: string, full: string) => void | Promise<void>} onDelta
 */
async function consumeSseLine(line, state, fullContent, onDelta) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return fullContent;

  const data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return fullContent;

  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    return fullContent;
  }

  if (parsed.usage) {
    state.usage = parsed.usage;
  }

  return appendStreamContent(parsed, fullContent, onDelta);
}

export async function callLlmOpenAIStream(baseUrl, apiKey, model, messages, opts, onDelta) {
  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens || 1024,
    temperature: opts.temperature ?? 0.7,
    ...(opts.topP !== undefined ? { top_p: opts.topP } : {}),
    ...(opts.frequencyPenalty !== undefined ? { frequency_penalty: opts.frequencyPenalty } : {}),
    ...(opts.presencePenalty !== undefined ? { presence_penalty: opts.presencePenalty } : {}),
    ...(opts.stopSequences ? { stop: opts.stopSequences.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
    stream: true,
    stream_options: { include_usage: true },
  };

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
  const streamHeaders = {
    ...headers,
    ...outboundStreamTags({
      feature: "llm_stream",
      projectId: opts.projectId,
      roomId: opts.roomId,
      runId: opts.runId,
    }),
  };
  const res = await fetchWithDoKeepalive(
    url,
    {
      method: "POST",
      headers: streamHeaders,
      body: JSON.stringify(body),
    },
    { feature: "llm_stream", projectId: opts.projectId, roomId: opts.roomId, runId: opts.runId },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI stream error ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!res.body) {
    throw new Error("OpenAI stream response has no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";
  let fullContent = "";
  const state = { usage: { prompt_tokens: 0, completion_tokens: 0 } };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuffer += decoder.decode(value, { stream: true });

      let newlineIndex = lineBuffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = lineBuffer.slice(0, newlineIndex);
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        newlineIndex = lineBuffer.indexOf("\n");
        fullContent = await consumeSseLine(line, state, fullContent, onDelta);
      }
    }

    lineBuffer += decoder.decode();
    if (lineBuffer.trim()) {
      fullContent = await consumeSseLine(lineBuffer, state, fullContent, onDelta);
    }

    return { content: fullContent, usage: state.usage };
  } catch (err) {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
    throw err;
  }
}
