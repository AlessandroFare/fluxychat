import { describe, expect, it, vi } from "vitest";
import { runAgentLoop, type AITool } from "./agent-loop";

describe("prepareStep callback", () => {
  it("receives step number context", async () => {
    const prepareStep = vi.fn();
    await runAgentLoop({
      runStep: async () => ({ text: "hi", finishReason: "stop" }),
      prepareStep,
    });
    expect(prepareStep).toHaveBeenCalledTimes(1);
    const ctx = prepareStep.mock.calls[0][0];
    expect(ctx.stepNumber).toBe(0);
    expect(ctx.toolResults).toEqual([]);
  });

  it("can override runtime context", async () => {
    const prepareStep = vi.fn().mockResolvedValue({ runtime: { role: "admin" } });
    let capturedRuntime: unknown;
    await runAgentLoop({
      runStep: async (state) => {
        capturedRuntime = state.runtime;
        return { text: "ok", finishReason: "stop" };
      },
      runtime: { role: "user" },
      prepareStep,
    });
    expect(capturedRuntime).toEqual({ role: "admin" });
  });

  it("can override tool contexts", async () => {
    const prepareStep = vi.fn().mockResolvedValue({
      toolContexts: { greeter: { greeting: "Ciao" } },
    });
    let capturedToolContext: unknown;
    await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "c1", name: "greeter", input: {} }],
        finishReason: "tool-calls",
      }),
      tools: {
        greeter: {
          inputSchema: {},
          execute: async (_input, ctx) => {
            capturedToolContext = ctx.tool;
            return "done";
          },
        },
      },
      prepareStep,
      maxSteps: 2,
    });
    expect(capturedToolContext).toEqual({ greeting: "Ciao" });
  });

  it("can filter allowed tools", async () => {
    const executeBlocked = vi.fn();
    const prepareStep = vi.fn().mockResolvedValue({ allowTools: ["allowedTool"] });
    await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [
          { id: "c1", name: "allowedTool", input: {} },
          { id: "c2", name: "blockedTool", input: {} },
        ],
        finishReason: "tool-calls",
      }),
      tools: {
        allowedTool: { inputSchema: {}, execute: async () => "ok" },
        blockedTool: { inputSchema: {}, execute: executeBlocked },
      },
      prepareStep,
      maxSteps: 2,
    });
    expect(executeBlocked).not.toHaveBeenCalled();
  });

  it("default prepareStep returns void, uses initial settings", async () => {
    let prepareCalled = false;
    await runAgentLoop({
      runStep: async () => ({ text: "ok", finishReason: "stop" }),
      prepareStep: async () => {
        prepareCalled = true;
        // returning void keeps defaults
      },
    });
    expect(prepareCalled).toBe(true);
  });
});
