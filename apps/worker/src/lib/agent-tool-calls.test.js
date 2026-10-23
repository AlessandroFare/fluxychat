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

  it("lets askHuman through an empty env allow-list", () => {
    const r = validateToolCall(
      {
        id: "call_h",
        function: { name: "askHuman", arguments: '{"prompt":"ok?"}' },
      },
      [{ function: { name: "askHuman" } }],
      "run-h",
      null,
      new Set(),
    );
    expect(r.valid).toBe(true);
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

  it("blocks tool names not in the project allow-list (audit S-35)", () => {
    const registered = [
      { type: "function", function: { name: "search_docs" } },
      { type: "function", function: { name: "delete_user" } },
    ];
    // Project only allows `search_docs`. The LLM tries `delete_user`,
    // which is in the declared schema but blocked by the allow-list.
    const allowSet = new Set(["search_docs"]);
    const out = extractOpenAIToolCalls(
      {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_x",
                  type: "function",
                  function: { name: "search_docs", arguments: '{"q":"hello"}' },
                },
                {
                  id: "call_y",
                  type: "function",
                  function: { name: "delete_user", arguments: '{"id":1}' },
                },
              ],
            },
          },
        ],
      },
      registered,
      "run-s35-1",
      allowSet
    );
    expect(out.toolCalls.map((t) => t.name)).toEqual(["search_docs"]);
    expect(
      out.invalidWarnings.some((w) =>
        w.includes("blocked_by_project_allowlist")
      )
    ).toBe(true);
  });

  it("denies all tool calls when the allow-list is empty (audit S-35)", () => {
    const registered = [{ type: "function", function: { name: "search_docs" } }];
    const allowSet = new Set(); // empty → deny all
    const out = extractOpenAIToolCalls(
      {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_z",
                  type: "function",
                  function: { name: "search_docs", arguments: "{}" },
                },
              ],
            },
          },
        ],
      },
      registered,
      "run-s35-2",
      allowSet
    );
    expect(out.toolCalls).toHaveLength(0);
  });
});

describe("validateToolCall (JSON Schema gate, P25-9)", () => {
  const withSchema = [
    {
      type: "function",
      function: {
        name: "book_flight",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string" },
            seats: { type: "number", minimum: 1, maximum: 9 },
            cabin: { type: "string", enum: ["economy", "business"] },
            tags: { type: "array", items: { type: "string" } },
            note: { type: "string", nullable: true },
          },
          required: ["city", "seats"],
        },
      },
    },
  ];

  const call = (args) =>
    validateToolCall(
      {
        id: "call_s",
        type: "function",
        function: { name: "book_flight", arguments: JSON.stringify(args) },
      },
      withSchema,
      "run-s",
    );

  it("accepts arguments that match the schema", () => {
    const r = call({ city: "Rome", seats: 2, cabin: "economy", tags: ["a"] });
    expect(r.valid).toBe(true);
    expect(JSON.parse(r.toolCall.arguments)).toEqual({
      city: "Rome",
      seats: 2,
      cabin: "economy",
      tags: ["a"],
    });
  });

  it("rejects a missing required property", () => {
    const r = call({ seats: 2 });
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("tool_call_invalid_arguments_schema");
    expect(r.warning).toContain("city is required");
  });

  it("rejects a wrong type", () => {
    const r = call({ city: 42, seats: 2 });
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("must be of type string");
  });

  it("rejects an enum violation", () => {
    const r = call({ city: "Rome", seats: 2, cabin: "vip" });
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("must be one of");
  });

  it("rejects an invalid array item and accepts null on a nullable field", () => {
    expect(call({ city: "Rome", seats: 2, tags: ["a", 3] }).valid).toBe(false);
    expect(call({ city: "Rome", seats: 2, note: null }).valid).toBe(true);
  });

  it("skips the gate when the tool declares no parameters", () => {
    const r = validateToolCall(
      { id: "c1", function: { name: "search_docs", arguments: '{"anything":true}' } },
      registered,
      "run-np"
    );
    expect(r.valid).toBe(true);
  });

  it("skips the gate for askHuman (own runtime validation)", () => {
    const r = validateToolCall(
      { id: "c2", function: { name: "askHuman", arguments: "{}" } },
      [
        {
          type: "function",
          function: {
            name: "askHuman",
            parameters: {
              type: "object",
              required: ["prompt"],
              properties: { prompt: { type: "string" } },
            },
          },
        },
      ],
      "run-h2"
    );
    expect(r.valid).toBe(true);
  });

  it("strips schema-invalid calls in extractOpenAIToolCalls", () => {
    const out = extractOpenAIToolCalls(
      {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "ok",
                  type: "function",
                  function: { name: "book_flight", arguments: '{"city":"Rome","seats":2}' },
                },
                {
                  id: "bad",
                  type: "function",
                  function: { name: "book_flight", arguments: '{"city":"Rome"}' },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      },
      withSchema,
      "run-x"
    );
    expect(out.toolCalls.map((t) => t.id)).toEqual(["ok"]);
    expect(
      out.invalidWarnings.some((w) => w.includes("tool_call_invalid_arguments_schema"))
    ).toBe(true);
  });
});
