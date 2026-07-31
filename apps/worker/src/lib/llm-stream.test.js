import { describe, expect, it, vi } from "vitest";
import { callLlmOpenAIStream } from "./llm-stream.js";

function mockSseResponse(chunks) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true, value: undefined };
            const value = encoder.encode(chunks[index]);
            index += 1;
            return { done: false, value };
          },
        };
      },
    },
  };
}

describe("callLlmOpenAIStream", () => {
  it("accumulates delta chunks and trailing buffer without final newline", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockSseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
        'data: {"choices":[{"delta":{"content":"!"}}], "usage":{"prompt_tokens":10,"completion_tokens":3}}',
      ]),
    );

    const deltas = [];
    const { content, usage } = await callLlmOpenAIStream(
      "https://api.groq.com/openai/v1",
      "gsk_test",
      "llama-3.1-8b-instant",
      [{ role: "user", content: "hi" }],
      {},
      async (delta, full) => {
        deltas.push({ delta, full });
      },
    );

    expect(content).toBe("Hello!");
    expect(usage.completion_tokens).toBe(3);
    expect(deltas.at(-1)?.full).toBe("Hello!");
  });

  it("reads message.content when providers omit delta chunks", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockSseResponse([
        'data: {"choices":[{"message":{"content":"Ciao da Groq"}}], "usage":{"prompt_tokens":5,"completion_tokens":4}}\n',
      ]),
    );

    const { content } = await callLlmOpenAIStream(
      "https://api.groq.com/openai/v1",
      "gsk_test",
      "llama-3.1-8b-instant",
      [{ role: "user", content: "hi" }],
      {},
      async () => {},
    );

    expect(content).toBe("Ciao da Groq");
  });
});
