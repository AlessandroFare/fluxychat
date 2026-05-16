import { describe, expect, it } from "vitest";
import {
  extractAnthropicToolCalls,
  extractOpenAIToolCalls,
  normalizeToolCallShape,
  validateToolCall,
} from "./agent-tool-calls.js";

const registered = [{ function: { name: "search_docs" } }];

describe("normalizeToolCallShape", () => {
  it("reads OpenAI function tool_calls shape", () => {
    const n = normalizeToolCallShape({
      id: "call_1",
      type: "function",
      function: { name: "search_docs", arguments: '{"q":"hi"}' },
    });
    expect(n).toEqual({
      id: "call_1",
      name: "search_docs",
      arguments: '{"q":"hi"}',
    });
  });

  it("reads flat name/arguments shape", () => {
    const n = normalizeToolCallShape({
      id: "call_2",
      name: "search_docs",
      arguments: { q: "hi" },
    });
    expect(n?.name).toBe("search_docs");
  });
});

describe("validateToolCall", () => {
  it("rejects missing function.name (OpenAI malformed)", () => {
    const r = validateToolCall(
      { id: "call_x", type: "function", function: { arguments: "{}" } },
      registered,
      "run-1"
    );
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("missing_name");
  });

  it("accepts valid OpenAI tool call", () => {
    const r = validateToolCall(
      {
        id: "call_ok",
        type: "function",
        function: { name: "search_docs", arguments: '{"q":1}' },
      },
      registered,
      "run-2"
    );
    expect(r.valid).toBe(true);
    expect(r.toolCall?.name).toBe("search_docs");
    expect(JSON.parse(r.toolCall.arguments)).toEqual({ q: 1 });
  });

  it("rejects unknown tool name when schema registered", () => {
    const r = validateToolCall(
      {
        id: "call_bad",
        function: { name: "other", arguments: "{}" },
      },
      registered,
      "run-3"
    );
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("unknown_name");
  });
});

describe("extractOpenAIToolCalls", () => {
  it("skips invalid tool calls instead of passing undefined name", () => {
    const out = extractOpenAIToolCalls(
      {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "bad",
                  function: { arguments: "{}" },
                },
                {
                  id: "good",
                  function: { name: "search_docs", arguments: "{}" },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      },
      registered,
      "run-4"
    );
    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0].name).toBe("search_docs");
    expect(out.invalidWarnings.length).toBeGreaterThan(0);
  });
});

describe("extractAnthropicToolCalls", () => {
  it("maps tool_use blocks and merges text", () => {
    const out = extractAnthropicToolCalls(
      {
        content: [
          { type: "text", text: "Let me " },
          { type: "text", text: "search." },
          {
            type: "tool_use",
            id: "toolu_1",
            name: "search_docs",
            input: { q: "fluxy" },
          },
        ],
        stop_reason: "tool_use",
      },
      registered,
      "run-a1"
    );
    expect(out.content).toBe("Let me search.");
    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0]).toMatchObject({
      id: "toolu_1",
      name: "search_docs",
    });
    expect(JSON.parse(out.toolCalls[0].arguments)).toEqual({ q: "fluxy" });
    expect(out.stopReason).toBe("tool_use");
  });

  it("skips tool_use without name", () => {
    const out = extractAnthropicToolCalls(
      {
        content: [
          { type: "tool_use", id: "toolu_bad", name: "", input: {} },
          { type: "tool_use", id: "toolu_ok", name: "search_docs", input: {} },
        ],
        stop_reason: "tool_use",
      },
      registered,
      "run-a2"
    );
    expect(out.toolCalls).toHaveLength(1);
    expect(out.invalidWarnings.some((w) => w.includes("missing_name"))).toBe(true);
  });

  it("rejects tool_use with invalid JSON string input", () => {
    const out = extractAnthropicToolCalls(
      {
        content: [
          {
            type: "tool_use",
            id: "toolu_x",
            name: "search_docs",
            input: "not-valid-json{",
          },
        ],
        stop_reason: "tool_use",
      },
      registered,
      "run-a3"
    );
    expect(out.toolCalls).toHaveLength(0);
    expect(
      out.invalidWarnings.some((w) => w.includes("invalid_arguments_json"))
    ).toBe(true);
  });
});
