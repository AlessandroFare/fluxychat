/**
 * OpenAI-compatible chat/completions streaming (SSE).
 */

export async function callLlmOpenAIStream(baseUrl, apiKey, model, messages, opts, onDelta) {
  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens || 1024,
    temperature: opts.temperature ?? 0.7,
    stream: true,
    stream_options: { include_usage: true },
  };

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

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
  let usage = { prompt_tokens: 0, completion_tokens: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    lineBuffer += decoder.decode(value, { stream: true });

    let newlineIndex = lineBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = lineBuffer.slice(0, newlineIndex).trim();
      lineBuffer = lineBuffer.slice(newlineIndex + 1);
      newlineIndex = lineBuffer.indexOf("\n");

      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      if (parsed.usage) {
        usage = parsed.usage;
      }

      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        fullContent += delta;
        await onDelta(delta, fullContent);
      }
    }
  }

  return { content: fullContent, usage };
}
