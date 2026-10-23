import { describe, expect, it } from "vitest";
import { lintOpsDefinition } from "./ops-lint.js";
import { enableAllBuiltinTools, defaultOpsPolicy } from "./ops-policy.js";

const tools = enableAllBuiltinTools();
const policy = defaultOpsPolicy();

describe("ops-lint", () => {
  it("blocks unknown tools and writes without approval", () => {
    const bad = lintOpsDefinition(
      {
        slug: "x",
        steps: [
          { id: "pay", type: "tool_call", tool: "invented.zap", timeout: { after: "1m" }, next: "end" },
          { id: "end", type: "end", timeout: { after: "1s" } },
        ],
      },
      { tools, policy },
    );
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((e) => e.code === "unknown_tool")).toBe(true);
    expect(bad.errors.some((e) => e.code === "write_requires_approval")).toBe(true);
  });

  it("accepts a generic write gated by approval and high-risk quorum", () => {
    const good = lintOpsDefinition(
      {
        slug: "access",
        steps: [
          { id: "review", type: "human_task", assignee: { role: "security" }, timeout: { after: "1d" }, next: "approve" },
          {
            id: "approve",
            type: "approval",
            roles: ["security"],
            quorum: { default: 2 },
            timeout: { after: "1d" },
            next: "write",
          },
          { id: "write", type: "tool_call", tool: "mcp.call", timeout: { after: "1m" }, next: "end" },
          { id: "end", type: "end", timeout: { after: "1s" } },
        ],
      },
      { tools, policy },
    );
    expect(good.ok).toBe(true);
  });

  it("warns when a tool_call is missing required tool input, without blocking publish", () => {
    const draft = (input) =>
      lintOpsDefinition(
        {
          slug: "access",
          steps: [
            { id: "review", type: "human_task", assignee: { role: "security" }, timeout: { after: "1d" }, next: "approve" },
            { id: "approve", type: "approval", roles: ["security"], quorum: { default: 2 }, timeout: { after: "1d" }, next: "write" },
            { id: "write", type: "tool_call", tool: "mcp.call", ...(input ? { input } : {}), timeout: { after: "1m" }, next: "end" },
            { id: "end", type: "end", timeout: { after: "1s" } },
          ],
        },
        { tools, policy },
      );

    const warned = draft(null);
    expect(warned.ok).toBe(true);
    expect(warned.warnings).toContainEqual({
      code: "tool_input_missing",
      message: expect.stringContaining("mcp.call is missing required input server, tool"),
      stepId: "write",
    });

    const filled = draft({ server: "grafana", tool: "query" });
    expect(filled.ok).toBe(true);
    expect(filled.warnings.filter((w) => w.code === "tool_input_missing")).toHaveLength(0);
  });

  it("requires citations on file-search agent tasks", () => {
    const denied = lintOpsDefinition(
      {
        slug: "research",
        steps: [
          {
            id: "research",
            type: "agent_task",
            tools: ["files.search"],
            cite: false,
            budget: { maxToolCalls: 3, maxTokens: 1000 },
            timeout: { after: "5m" },
            next: "end",
          },
          { id: "end", type: "end", timeout: { after: "1s" } },
        ],
      },
      { tools, policy },
    );
    expect(denied.ok).toBe(false);
    expect(denied.errors.some((e) => e.code === "citations_required")).toBe(true);
  });
});
