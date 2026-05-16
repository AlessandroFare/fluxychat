import { describe, it, expect } from "vitest";
import { buildToolResultMessage, estimateCost } from "./agent-llm.js";

describe("buildToolResultMessage", () => {
  it("formats OpenAI tool result messages", () => {
    const msg = buildToolResultMessage(
      { providerId: "openai", baseUrl: "https://api.openai.com" },
      { id: "call_1", name: "ping", arguments: "{}" },
      { success: true, result: { ok: true } }
    );
    expect(msg).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: JSON.stringify({ ok: true }),
    });
  });

  it("formats Anthropic tool_result blocks", () => {
    const msg = buildToolResultMessage(
      { providerId: "anthropic", apiStyle: "anthropic", apiKey: "k" },
      { id: "toolu_1", name: "ping", arguments: "{}" },
      { success: false, error: "boom" }
    );
    expect(msg.role).toBe("user");
    expect(msg.content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "toolu_1",
      content: "Error: boom",
    });
  });
});

describe("estimateCost", () => {
  it("computes token cost from provider pricing table", () => {
    const cost = estimateCost("openai", "gpt-4o-mini", 1000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1);
  });
});
