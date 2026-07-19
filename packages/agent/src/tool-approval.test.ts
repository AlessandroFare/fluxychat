import { describe, expect, it, beforeEach } from "vitest";
import {
  normalizeToolApprovalStatus,
  resolveToolApproval,
  createApprovalId,
  hashCanonical,
  signApproval,
  verifyApprovalSignature,
  type ToolApprovalConfig,
  type ToolApprovalStatus,
  type ToolApprovalDecision,
} from "./tool-approval";
import { runAgentLoop, type AITool, type AIToolCall } from "./agent-loop";
import { DeterministicLanguageModel } from "./providers";
import { generate } from "./generation";
import type { AIToolContext } from "./agent-loop";

describe("normalizeToolApprovalStatus", () => {
  it("returns not-applicable for undefined", () => {
    expect(normalizeToolApprovalStatus(undefined)).toEqual({ type: "not-applicable" });
  });

  it("accepts string statuses", () => {
    expect(normalizeToolApprovalStatus("approved")).toEqual({ type: "approved" });
    expect(normalizeToolApprovalStatus("denied")).toEqual({ type: "denied" });
    expect(normalizeToolApprovalStatus("user-approval")).toEqual({ type: "user-approval" });
    expect(normalizeToolApprovalStatus("not-applicable")).toEqual({ type: "not-applicable" });
  });

  it("accepts object statuses", () => {
    expect(normalizeToolApprovalStatus({ type: "approved", reason: "Auto" })).toEqual({
      type: "approved", reason: "Auto",
    });
    expect(normalizeToolApprovalStatus({ type: "denied", reason: "No" })).toEqual({
      type: "denied", reason: "No",
    });
  });
});

describe("resolveToolApproval", () => {
  it("returns not-applicable when no config", async () => {
    const result = await resolveToolApproval(undefined, { id: "1", name: "test", input: {} });
    expect(result).toEqual({ type: "not-applicable" });
  });

  it("supports per-tool string config", async () => {
    const config: ToolApprovalConfig = { dangerous: "user-approval", readonly: "approved" };
    expect(await resolveToolApproval(config, { id: "1", name: "dangerous", input: {} })).toEqual({
      type: "user-approval",
    });
    expect(await resolveToolApproval(config, { id: "2", name: "readonly", input: {} })).toEqual({
      type: "approved",
    });
  });

  it("returns not-applicable for unconfigured tool", async () => {
    const config: ToolApprovalConfig = { dangerous: "user-approval" };
    expect(await resolveToolApproval(config, { id: "1", name: "other", input: {} })).toEqual({
      type: "not-applicable",
    });
  });

  it("supports per-tool function config", async () => {
    const config: ToolApprovalConfig = {
      payment: async (input: unknown) => {
        const amount = (input as { amount?: number }).amount ?? 0;
        return amount > 100 ? "user-approval" : "approved";
      },
    };
    expect(await resolveToolApproval(config, { id: "1", name: "payment", input: { amount: 50 } })).toEqual({
      type: "approved",
    });
    expect(await resolveToolApproval(config, { id: "2", name: "payment", input: { amount: 500 } })).toEqual({
      type: "user-approval",
    });
  });

  it("supports generic function config", async () => {
    const config: ToolApprovalConfig = ({ toolCall }) => {
      if (toolCall.name === "delete") return { type: "denied", reason: "Delete disabled" };
      return undefined;
    };
    expect(await resolveToolApproval(config, { id: "1", name: "delete", input: {} })).toEqual({
      type: "denied", reason: "Delete disabled",
    });
    expect(await resolveToolApproval(config, { id: "2", name: "read", input: {} })).toEqual({
      type: "not-applicable",
    });
  });

  it("passes runtime context to generic function", async () => {
    const config: ToolApprovalConfig = ({ runtime }) => {
      return (runtime as { role?: string }).role === "admin" ? "approved" : "user-approval";
    };
    expect(await resolveToolApproval(config, { id: "1", name: "x", input: {} }, { runtime: { role: "admin" } })).toEqual({
      type: "approved",
    });
    expect(await resolveToolApproval(config, { id: "2", name: "x", input: {} }, { runtime: { role: "user" } })).toEqual({
      type: "user-approval",
    });
  });
});

describe("createApprovalId", () => {
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createApprovalId()));
    expect(ids.size).toBe(100);
  });

  it("starts with apr_ prefix", () => {
    expect(createApprovalId()).toMatch(/^apr_/);
  });
});

describe("hashCanonical", () => {
  it("produces deterministic hashes", async () => {
    const a = await hashCanonical({ b: 1, a: 2 });
    const b = await hashCanonical({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it("produces different hashes for different values", async () => {
    const a = await hashCanonical("hello");
    const b = await hashCanonical("world");
    expect(a).not.toBe(b);
  });
});

describe("signApproval + verifyApprovalSignature", () => {
  const secret = "test-secret-key-12345";

  it("signs and verifies a tool approval", async () => {
    const signature = await signApproval({
      secret,
      approvalId: "apr_1",
      toolCallId: "call_1",
      toolName: "testTool",
      input: { amount: 100, recipient: "alice" },
    });
    expect(signature).toBeTruthy();
    expect(typeof signature).toBe("string");
    expect(signature.length).toBeGreaterThan(10);

    const valid = await verifyApprovalSignature({
      secret,
      signature,
      approvalId: "apr_1",
      toolCallId: "call_1",
      toolName: "testTool",
      input: { amount: 100, recipient: "alice" },
    });
    expect(valid).toBe(true);
  });

  it("rejects tampered signature", async () => {
    const signature = await signApproval({
      secret,
      approvalId: "apr_1",
      toolCallId: "call_1",
      toolName: "testTool",
      input: { amount: 100 },
    });
    const valid = await verifyApprovalSignature({
      secret,
      signature,
      approvalId: "apr_1",
      toolCallId: "call_1",
      toolName: "testTool",
      input: { amount: 999 }, // tampered input
    });
    expect(valid).toBe(false);
  });

  it("rejects with wrong secret", async () => {
    const signature = await signApproval({
      secret,
      approvalId: "apr_1",
      toolCallId: "call_1",
      toolName: "testTool",
      input: {},
    });
    const valid = await verifyApprovalSignature({
      secret: "wrong-secret",
      signature,
      approvalId: "apr_1",
      toolCallId: "call_1",
      toolName: "testTool",
      input: {},
    });
    expect(valid).toBe(false);
  });

  it("supports Uint8Array secrets", async () => {
    const bytes = new TextEncoder().encode("binary-secret-key");
    const signature = await signApproval({
      secret: bytes,
      approvalId: "apr_1",
      toolCallId: "call_1",
      toolName: "testTool",
      input: { data: "test" },
    });
    const valid = await verifyApprovalSignature({
      secret: bytes,
      signature,
      approvalId: "apr_1",
      toolCallId: "call_1",
      toolName: "testTool",
      input: { data: "test" },
    });
    expect(valid).toBe(true);
  });

  it("binds signature to tool name", async () => {
    const signature = await signApproval({
      secret, approvalId: "apr_1", toolCallId: "call_1", toolName: "toolA", input: {},
    });
    const valid = await verifyApprovalSignature({
      secret, signature, approvalId: "apr_1", toolCallId: "call_1", toolName: "toolB", input: {},
    });
    expect(valid).toBe(false);
  });
});

describe("tool approval in agent loop", () => {
  // Helper: create a deterministic model that always calls a tool
  function toolCallingModel(toolName: string) {
    return new DeterministicLanguageModel(() =>
      `Tool called: ${toolName}`,
    );
  }

  it("denies tool execution via toolApproval config", async () => {
    const tool: AITool = {
      inputSchema: {},
      execute: async () => "should-not-execute",
    };
    const result = await runAgentLoop({
      runStep: async () => {
        return {
          text: "",
          toolCalls: [{ id: "call_1", name: "dangerous", input: {} }],
          finishReason: "tool-calls",
        };
      },
      tools: { dangerous: tool },
      toolApproval: { dangerous: { type: "denied", reason: "Not allowed" } },
      maxSteps: 2,
    });
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0].approval?.status).toBe("denied");
    expect(result.toolResults[0].approval?.reason).toBe("Not allowed");
    expect(result.toolResults[0].output).toBeUndefined();
    expect(result.toolResults[0].error).toBeTruthy();
  });

  it("auto-approves tool execution via toolApproval config", async () => {
    let executed = false;
    const tool: AITool = {
      inputSchema: {},
      execute: async () => { executed = true; return "approved-result"; },
    };
    const result = await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "call_1", name: "safe", input: {} }],
        finishReason: "tool-calls",
      }),
      tools: { safe: tool },
      toolApproval: { safe: "approved" },
      maxSteps: 2,
    });
    expect(executed).toBe(true);
    expect(result.toolResults[0].output).toBe("approved-result");
  });

  it("calls onApprovalRequired for user-approval", async () => {
    let approvalCalled = false;
    const tool: AITool = {
      inputSchema: {},
      execute: async () => "executed-after-approval",
    };
    const result = await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "call_1", name: "needsOk", input: {} }],
        finishReason: "tool-calls",
      }),
      tools: { needsOk: tool },
      toolApproval: { needsOk: "user-approval" },
      onApprovalRequired: async () => {
        approvalCalled = true;
        return true;
      },
      maxSteps: 2,
    });
    expect(approvalCalled).toBe(true);
    expect(result.toolResults[0].output).toBe("executed-after-approval");
  });

  it("denies when onApprovalRequired returns false", async () => {
    let executed = false;
    const tool: AITool = {
      inputSchema: {},
      execute: async () => { executed = true; return "should-not-run"; },
    };
    const result = await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "call_1", name: "needsOk", input: {} }],
        finishReason: "tool-calls",
      }),
      tools: { needsOk: tool },
      toolApproval: { needsOk: "user-approval" },
      onApprovalRequired: async () => false,
      maxSteps: 2,
    });
    expect(executed).toBe(false);
    expect(result.toolResults[0].approval?.status).toBe("denied");
  });

  it("backward compat: needsApproval still works without toolApproval config", async () => {
    let approvalCalled = false;
    const tool: AITool = {
      inputSchema: {},
      needsApproval: () => true,
      execute: async () => "executed",
    };
    const result = await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "call_1", name: "legacy", input: {} }],
        finishReason: "tool-calls",
      }),
      tools: { legacy: tool },
      onApprovalRequired: async () => { approvalCalled = true; return true; },
      maxSteps: 2,
    });
    expect(approvalCalled).toBe(true);
    expect(result.toolResults[0].output).toBe("executed");
  });

  it("toolApproval takes precedence over needsApproval", async () => {
    let approvalCalled = false;
    const tool: AITool = {
      inputSchema: {},
      needsApproval: () => true, // would normally require approval
      execute: async () => "auto-approved",
    };
    const result = await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "call_1", name: "override", input: {} }],
        finishReason: "tool-calls",
      }),
      tools: { override: tool },
      toolApproval: { override: "approved" }, // overrides needsApproval
      onApprovalRequired: async () => { approvalCalled = true; return true; },
      maxSteps: 2,
    });
    expect(approvalCalled).toBe(false); // not called because approved
    expect(result.toolResults[0].output).toBe("auto-approved");
  });
});
