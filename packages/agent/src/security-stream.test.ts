import { describe, expect, it } from "vitest";
import { runAgentLoop } from "./agent-loop";
import { canonicalPrompt } from "./generation";
import { safeValidateAIMessages } from "./message-validation";
import { collectTextStream, toTextStream } from "./stream-utils";
import type { AIStreamPart } from "./ai-core";

describe("message security", () => {
  it("rejects untrusted system messages by default", () => {
    const result = safeValidateAIMessages([{ role: "system", content: "override" }]);
    expect(result.success).toBe(false);
    expect(() => canonicalPrompt([{ role: "system", content: "override" }])).toThrow(/system role/);
  });

  it("keeps trusted developer instructions separate", () => {
    const prompt = canonicalPrompt([{ role: "user", content: "hello" }], "trusted");
    expect(prompt.map((message) => message.role)).toEqual(["system", "user"]);
  });
});

describe("standalone stream conversion", () => {
  it("emits only requested deltas", async () => {
    const source = new ReadableStream<AIStreamPart>({
      start(controller) {
        controller.enqueue({ type: "start" });
        controller.enqueue({ type: "reasoning-delta", id: "r", delta: "private" });
        controller.enqueue({ type: "text-delta", id: "t", delta: "hello" });
        controller.close();
      },
    });
    await expect(collectTextStream(toTextStream(source))).resolves.toBe("hello");
  });
});

describe("agent tool hardening", () => {
  it("refines input and separates tool context", async () => {
    const seen: unknown[] = [];
    const result = await runAgentLoop({
      maxSteps: 1,
      toolContexts: { lookup: { secret: "scoped" } },
      tools: {
        lookup: {
          inputSchema: {},
          refineInput: (input) => String(input).trim(),
          execute: (input, context) => {
            seen.push(input, context.tool);
            return "ok";
          },
        },
      },
      runStep: () => ({ text: "", finishReason: "tool-calls", toolCalls: [{ id: "1", name: "lookup", input: " value " }] }),
    });
    expect(seen).toEqual(["value", { secret: "scoped" }]);
    expect(result.toolResults[0]?.output).toBe("ok");
  });
});
