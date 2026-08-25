import { describe, expect, it, vi } from "vitest";
import {
  buildGenAiChatAttributes,
  buildGenAiToolAttributes,
  emitGenAiChatSpan,
  emitGenAiToolSpan,
  enqueueGenAiSpans,
  hexIdFromKey,
  tokenUsageFromLlmResponse,
} from "./genai-spans.js";

describe("genai spans", () => {
  it("pads run ids to 32 hex chars", () => {
    expect(hexIdFromKey("abc").length).toBe(32);
    expect(hexIdFromKey("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "a1b2c3d4e5f67890abcdef1234567890",
    );
  });

  it("emits gen_ai chat attributes", () => {
    const attrs = buildGenAiChatAttributes({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 12,
      outputTokens: 4,
      roomId: "room-1",
      agentId: "bot-1",
      runId: "run-1",
      finishReason: "stop",
    });
    expect(attrs["gen_ai.operation.name"]).toBe("chat");
    expect(attrs["gen_ai.provider.name"]).toBe("openai");
    expect(attrs["gen_ai.request.model"]).toBe("gpt-4o-mini");
    expect(attrs["gen_ai.usage.input_tokens"]).toBe("12");
    expect(attrs["gen_ai.conversation.id"]).toBe("room-1");
  });

  it("emits gen_ai tool attributes", () => {
    const attrs = buildGenAiToolAttributes({
      toolName: "run_agent",
      toolCallId: "call_1",
      success: true,
      roomId: "r",
    });
    expect(attrs["gen_ai.operation.name"]).toBe("execute_tool");
    expect(attrs["gen_ai.tool.name"]).toBe("run_agent");
    expect(attrs["gen_ai.tool.status"]).toBe("ok");
  });

  it("reads OpenAI and Anthropic usage", () => {
    expect(tokenUsageFromLlmResponse({ usage: { prompt_tokens: 3, completion_tokens: 5 } }, false)).toEqual({
      inputTokens: 3,
      outputTokens: 5,
    });
    expect(tokenUsageFromLlmResponse({ usage: { input_tokens: 8, output_tokens: 2 } }, true)).toEqual({
      inputTokens: 8,
      outputTokens: 2,
    });
  });

  it("queues spans to enabled otel configs", async () => {
    const insert = vi.fn(async () => ({ success: true }));
    const env = {
      DB: {
        prepare(sql) {
          if (sql.includes("otel_export_config")) {
            return {
              bind() {
                return { all: async () => ({ results: [{ id: "cfg-1" }] }) };
              },
            };
          }
          return {
            bind() {
              return { run: insert };
            },
          };
        },
      },
    };
    const out = await enqueueGenAiSpans(env, {
      projectId: "p1",
      spans: [{ name: "chat", traceId: "t".repeat(32) }],
    });
    expect(out.queued).toBe(1);
    expect(insert).toHaveBeenCalled();
  });

  it("builds chat and tool spans with nano timestamps", () => {
    const chat = emitGenAiChatSpan({}, {
      runId: "run-abc",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1,
      outputTokens: 2,
      ok: true,
      startedAtMs: 1_000,
      endedAtMs: 1_250,
    });
    expect(chat.name).toBe("chat");
    expect(chat.startTimeUnixNano).toBe(String(1_000n * 1_000_000n));
    expect(chat.attributes.some((a) => a.key === "gen_ai.operation.name" && a.value.stringValue === "chat")).toBe(true);

    const tool = emitGenAiToolSpan({}, {
      runId: "run-abc",
      toolName: "search",
      toolCallId: "c1",
      success: false,
      startedAtMs: 1_000,
      endedAtMs: 1_010,
    });
    expect(tool.name).toBe("execute_tool");
    expect(tool.status.code).toBe("ERROR");
  });
});
