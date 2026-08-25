import { describe, expect, it, vi } from "vitest";
import {
  isNestedAgentToolName,
  parseNestedAgentToolArgs,
  withNestedAgentTool,
  isSelfDelegate,
  runNestedAgentTool,
  MAX_NESTED_AGENT_DEPTH,
} from "./agent-nested-run.js";

describe("nested agent tool", () => {
  it("recognizes run_agent aliases", () => {
    expect(isNestedAgentToolName("run_agent")).toBe(true);
    expect(isNestedAgentToolName("invoke-agent")).toBe(true);
    expect(isNestedAgentToolName("web_search")).toBe(false);
  });

  it("parses target + prompt", () => {
    expect(parseNestedAgentToolArgs('{"handle":"@researcher","prompt":"summarize"}')).toEqual({
      ok: true,
      prompt: "summarize",
      agentId: "",
      handle: "@researcher",
    });
    expect(parseNestedAgentToolArgs("{}").ok).toBe(false);
  });

  it("injects run_agent and strips HTTP tools without an executor", () => {
    const withoutHttp = withNestedAgentTool(
      [{ type: "function", function: { name: "search_docs" } }],
      false,
    );
    expect(withoutHttp).toHaveLength(1);
    expect(withoutHttp[0].function.name).toBe("run_agent");

    const withHttp = withNestedAgentTool(
      [{ type: "function", function: { name: "search_docs" } }],
      true,
    );
    expect(withHttp.map((t) => t.function.name)).toEqual(["search_docs", "run_agent"]);
  });

  it("blocks self-delegate", () => {
    expect(isSelfDelegate({ id: "a", handle: "@bot" }, { id: "a", handle: "@bot" })).toBe(true);
    expect(isSelfDelegate({ id: "a", handle: "@bot" }, { id: "b", handle: "@other" })).toBe(false);
  });

  it("runs a child executeAgentRun and returns timeline payload", async () => {
    const executeAgentRun = vi.fn(async () => ({
      status: "completed",
      runId: "child-run",
      content: "done",
      toolCalls: [{ id: "t1", name: "web_search" }],
      iterations: 1,
    }));
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                first: async () => ({ id: "child", handle: "@researcher", name: "Researcher" }),
              };
            },
          };
        },
      },
    };
    const out = await runNestedAgentTool({
      executeAgentRun,
      env,
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
      traceId: "t",
      parentAgentRow: { id: "parent", handle: "@assistant" },
      parentRunId: "parent-run",
      nestDepth: 0,
      toolCall: {
        id: "call_1",
        name: "run_agent",
        arguments: JSON.stringify({ handle: "@researcher", prompt: "look this up" }),
      },
    });
    expect(out.success).toBe(true);
    expect(out.result.content).toBe("done");
    expect(executeAgentRun).toHaveBeenCalledWith(
      env,
      expect.objectContaining({
        parentRunId: "parent-run",
        parentToolCallId: "call_1",
        nestDepth: 1,
        userMessage: "look this up",
      }),
    );
  });

  it("rejects when nest depth is exhausted", async () => {
    const out = await runNestedAgentTool({
      executeAgentRun: vi.fn(),
      env: {},
      projectId: "p",
      roomId: "r",
      userId: "u",
      traceId: "t",
      parentAgentRow: { id: "p" },
      parentRunId: "r1",
      nestDepth: MAX_NESTED_AGENT_DEPTH,
      toolCall: { id: "c", name: "run_agent", arguments: '{"handle":"x","prompt":"y"}' },
    });
    expect(out).toEqual({ success: false, error: "nested_agent_depth_exceeded" });
  });
});
