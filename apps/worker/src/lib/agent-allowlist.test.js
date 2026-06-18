import { describe, it, expect } from "vitest";
import {
  parseAgentToolAllowListFromEnv,
  validateToolCall,
  extractOpenAIToolCalls,
  extractAnthropicToolCalls,
} from "../lib/agent-tool-calls.js";

describe("parseAgentToolAllowListFromEnv (audit A-5)", () => {
  it("returns null when the env var is absent (legacy behaviour)", () => {
    expect(parseAgentToolAllowListFromEnv({})).toBeNull();
    expect(parseAgentToolAllowListFromEnv({ SOME_OTHER: "x" })).toBeNull();
  });

  it("returns null when env is null/undefined", () => {
    expect(parseAgentToolAllowListFromEnv(null)).toBeNull();
    expect(parseAgentToolAllowListFromEnv(undefined)).toBeNull();
  });

  it("returns an empty Set when the env var is set to empty string (fail-closed)", () => {
    const s = parseAgentToolAllowListFromEnv({ AGENT_TOOL_ALLOWLIST: "" });
    expect(s).toBeInstanceOf(Set);
    expect(s.size).toBe(0);
  });

  it("returns a Set with the listed tool names when the env var is non-empty", () => {
    const s = parseAgentToolAllowListFromEnv({ AGENT_TOOL_ALLOWLIST: "search,calculator" });
    expect(s).toBeInstanceOf(Set);
    expect(s.has("search")).toBe(true);
    expect(s.has("calculator")).toBe(true);
    expect(s.size).toBe(2);
  });

  it("trims whitespace around tool names", () => {
    const s = parseAgentToolAllowListFromEnv({ AGENT_TOOL_ALLOWLIST: "  search ,  calculator  " });
    expect(s.has("search")).toBe(true);
    expect(s.has("calculator")).toBe(true);
    expect(s.size).toBe(2);
  });

  it("drops empty entries from a comma-separated list", () => {
    const s = parseAgentToolAllowListFromEnv({ AGENT_TOOL_ALLOWLIST: "search,,,calculator," });
    expect(s.has("search")).toBe(true);
    expect(s.has("calculator")).toBe(true);
    expect(s.size).toBe(2);
  });

  it("treats a non-string value as empty Set", () => {
    const s = parseAgentToolAllowListFromEnv({ AGENT_TOOL_ALLOWLIST: 123 });
    expect(s).toBeInstanceOf(Set);
    expect(s.size).toBe(0);
  });
});

describe("validateToolCall  AGENT_TOOL_ALLOWLIST gate (audit A-5)", () => {
  const tc = {
    id: "call_1",
    function: { name: "search", arguments: '{"q":"hello"}' },
  };
  const registeredTools = [
    { function: { name: "search" } },
    { function: { name: "calculator" } },
    { function: { name: "dangerous_tool" } },
  ];

  it("passes when env allow-list contains the tool name", () => {
    const env = new Set(["search", "calculator"]);
    const r = validateToolCall(tc, registeredTools, "run-1", null, env);
    expect(r.valid).toBe(true);
  });

  it("strips when env allow-list does NOT contain the tool name", () => {
    const env = new Set(["search", "calculator"]);
    const tc2 = {
      id: "call_2",
      function: { name: "dangerous_tool", arguments: '{"x":1}' },
    };
    const r = validateToolCall(tc2, registeredTools, "run-1", null, env);
    expect(r.valid).toBe(false);
    expect(r.toolCall).toBeNull();
    expect(r.warning).toContain("blocked_by_env_allowlist");
    expect(r.warning).toContain("dangerous_tool");
  });

  it("strips ALL tools when env allow-list is empty (fail-closed)", () => {
    const env = new Set();
    const r = validateToolCall(tc, registeredTools, "run-1", null, env);
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("blocked_by_env_allowlist");
  });

  it("does NOT enforce the gate when env allow-list is null (absent env var)", () => {
    const r = validateToolCall(tc, registeredTools, "run-1", null, null);
    expect(r.valid).toBe(true);
  });

  it("the env gate fires before the project-allow-list check (env is the highest gate)", () => {
    // Project allow-list contains "search", env allow-list does not.
    // Result must be "stripped by env".
    const projectSet = new Set(["search", "calculator"]);
    const env = new Set(["calculator"]); // no "search"
    const r = validateToolCall(tc, registeredTools, "run-1", projectSet, env);
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("blocked_by_env_allowlist");
  });

  it("env allow-list passes for a tool NOT in the project allow-list (env is broader)", () => {
    // env lists "dangerous_tool" but project does not. The project gate
    // is still the next gate, so we expect the env gate to pass and
    // the project gate to strip.
    const projectSet = new Set(["search"]);
    const env = new Set(["search", "dangerous_tool"]);
    const tc2 = {
      id: "call_2",
      function: { name: "dangerous_tool", arguments: "{}" },
    };
    const r = validateToolCall(tc2, registeredTools, "run-1", projectSet, env);
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("blocked_by_project_allowlist");
  });
});

describe("extractOpenAIToolCalls  env allow-list integration (audit A-5)", () => {
  it("strips every tool call when env allow-list is empty (fail-closed)", () => {
    const response = {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            content: null,
            tool_calls: [
              { id: "c1", function: { name: "search", arguments: '{"q":"x"}' } },
              { id: "c2", function: { name: "calculator", arguments: '{"x":1}' } },
            ],
          },
        },
      ],
    };
    const registered = [
      { function: { name: "search" } },
      { function: { name: "calculator" } },
    ];
    const env = new Set();
    const out = extractOpenAIToolCalls(response, registered, "run-1", null, env);
    expect(out.toolCalls).toHaveLength(0);
    expect(out.invalidWarnings).toHaveLength(2);
    expect(out.invalidWarnings[0]).toContain("blocked_by_env_allowlist");
  });

  it("passes only the env-listed tools through", () => {
    const response = {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            content: null,
            tool_calls: [
              { id: "c1", function: { name: "search", arguments: '{"q":"x"}' } },
              { id: "c2", function: { name: "calculator", arguments: '{"x":1}' } },
              { id: "c3", function: { name: "dangerous", arguments: '{}' } },
            ],
          },
        },
      ],
    };
    const registered = [
      { function: { name: "search" } },
      { function: { name: "calculator" } },
      { function: { name: "dangerous" } },
    ];
    const env = new Set(["search"]);
    const out = extractOpenAIToolCalls(response, registered, "run-1", null, env);
    expect(out.toolCalls.map((t) => t.name)).toEqual(["search"]);
    expect(out.invalidWarnings).toHaveLength(2);
  });

  it("passes everything when env allow-list is null (legacy)", () => {
    const response = {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            content: null,
            tool_calls: [
              { id: "c1", function: { name: "search", arguments: '{"q":"x"}' } },
              { id: "c2", function: { name: "calculator", arguments: '{"x":1}' } },
            ],
          },
        },
      ],
    };
    const registered = [
      { function: { name: "search" } },
      { function: { name: "calculator" } },
    ];
    const out = extractOpenAIToolCalls(response, registered, "run-1", null, null);
    expect(out.toolCalls).toHaveLength(2);
    expect(out.invalidWarnings).toHaveLength(0);
  });
});

describe("extractAnthropicToolCalls  env allow-list integration (audit A-5)", () => {
  it("strips every tool_use block when env allow-list is empty", () => {
    const response = {
      content: [
        { type: "text", text: "ok" },
        { type: "tool_use", id: "u1", name: "search", input: { q: "x" } },
      ],
    };
    const registered = [{ function: { name: "search" } }];
    const out = extractAnthropicToolCalls(response, registered, "run-1", null, new Set());
    expect(out.toolCalls).toHaveLength(0);
    expect(out.invalidWarnings).toHaveLength(1);
  });
});
