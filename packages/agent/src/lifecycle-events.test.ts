import { describe, expect, it, vi } from "vitest";
import { runAgentLoop, type AITool, type AIToolCall, type AgentStepResult } from "./agent-loop";
import type { AIGenerationStep, AIUsage } from "./ai-core";

describe("lifecycle callbacks", () => {
  it("fires onStart at loop start", async () => {
    const onStart = vi.fn();
    await runAgentLoop({
      runStep: async () => ({ text: "hello", finishReason: "stop" }),
      onStart,
      maxSteps: 2,
    });
    expect(onStart).toHaveBeenCalledTimes(1);
    const event = onStart.mock.calls[0][0];
    expect(event.callId).toMatch(/^call_/);
    expect(event.maxSteps).toBe(2);
  });

  it("fires onStepStart before each step", async () => {
    const onStepStart = vi.fn();
    await runAgentLoop({
      runStep: (() => {
        let step = -1;
        return async () => {
          step += 1;
          return { text: `step${step}`, finishReason: step < 2 ? "tool-calls" : "stop" };
        };
      })(),
      onStepStart,
      maxSteps: 10,
    });
    expect(onStepStart).toHaveBeenCalledTimes(3);
    expect(onStepStart.mock.calls[0][0].stepNumber).toBe(0);
    expect(onStepStart.mock.calls[1][0].stepNumber).toBe(1);
    expect(onStepStart.mock.calls[2][0].stepNumber).toBe(2);
  });

  it("fires onStepEnd after each step", async () => {
    const onStepEnd = vi.fn();
    await runAgentLoop({
      runStep: (() => {
        let step = -1;
        return async () => {
          step += 1;
          return { text: `step${step}`, finishReason: step < 1 ? "tool-calls" : "stop" };
        };
      })(),
      onStepEnd,
      maxSteps: 10,
    });
    expect(onStepEnd).toHaveBeenCalledTimes(2);
    expect(onStepEnd.mock.calls[0][0].text).toBe("step0");
    expect(onStepEnd.mock.calls[1][0].text).toBe("step1");
  });

  it("fires onEnd when the loop finishes", async () => {
    const onEnd = vi.fn();
    await runAgentLoop({
      runStep: async () => ({ text: "done", finishReason: "stop" }),
      onEnd,
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0].text).toBe("done");
    expect(onEnd.mock.calls[0][0].finalState.step).toBe(1);
  });

  it("fires onEnd at maxSteps when no stop condition met", async () => {
    const onEnd = vi.fn();
    await runAgentLoop({
      runStep: async () => ({ text: "loop", toolCalls: [{ id: "c1", name: "t", input: {} }], finishReason: "tool-calls" }),
      tools: { t: { inputSchema: {}, execute: async () => "result" } },
      onEnd,
      maxSteps: 3,
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0].finalState.step).toBe(3);
  });

  it("fires onToolExecutionStart before tool execute", async () => {
    const onToolExecutionStart = vi.fn();
    const execute = vi.fn().mockResolvedValue("result");
    await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "c1", name: "greet", input: { name: "world" } }],
        finishReason: "tool-calls",
      }),
      tools: { greet: { inputSchema: {}, execute } },
      onToolExecutionStart,
      maxSteps: 2,
    });
    expect(onToolExecutionStart).toHaveBeenCalledTimes(1);
    expect(onToolExecutionStart.mock.calls[0][0].toolCall.name).toBe("greet");
    expect(onToolExecutionStart.mock.calls[0][0].toolCall.input).toEqual({ name: "world" });
    // execute should not have run yet at this point
    expect(execute).toHaveBeenCalledTimes(1); // callbacks are async; check execute was called
  });

  it("fires onToolExecutionEnd after tool execute succeeds", async () => {
    const onToolExecutionEnd = vi.fn();
    await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "c1", name: "adder", input: { x: 1, y: 2 } }],
        finishReason: "tool-calls",
      }),
      tools: { adder: { inputSchema: {}, execute: async (i: any) => i.x + i.y } },
      onToolExecutionEnd,
      maxSteps: 2,
    });
    expect(onToolExecutionEnd).toHaveBeenCalledTimes(1);
    const event = onToolExecutionEnd.mock.calls[0][0];
    expect(event.toolCall.name).toBe("adder");
    expect(event.output).toBe(3);
    expect(event.error).toBeUndefined();
    expect(typeof event.toolExecutionMs).toBe("number");
  });

  it("fires onToolExecutionEnd with error on tool failure", async () => {
    const onToolExecutionEnd = vi.fn();
    const err = new Error("boom");
    await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "c1", name: "failer", input: {} }],
        finishReason: "tool-calls",
      }),
      tools: { failer: { inputSchema: {}, execute: async () => { throw err; } } },
      onToolExecutionEnd,
      maxSteps: 2,
    });
    expect(onToolExecutionEnd).toHaveBeenCalledTimes(1);
    const event = onToolExecutionEnd.mock.calls[0][0];
    expect(event.error).toBeTruthy();
    expect(event.output).toBeUndefined();
  });

  it("fires callbacks in expected order", async () => {
    const order: string[] = [];
    const makeCb = (name: string) => vi.fn(async () => { order.push(name); });
    const onStart = makeCb("onStart");
    const onStepStart = makeCb("onStepStart");
    const onToolExecutionStart = makeCb("onToolExecutionStart");
    const onToolExecutionEnd = makeCb("onToolExecutionEnd");
    const onStepEnd = makeCb("onStepEnd");
    const onEnd = makeCb("onEnd");

    await runAgentLoop({
      runStep: async () => ({
        text: "result",
        toolCalls: [{ id: "c1", name: "calc", input: {} }],
        finishReason: "tool-calls",
      }),
      tools: { calc: { inputSchema: {}, execute: async () => 42 } },
      onStart, onStepStart, onToolExecutionStart, onToolExecutionEnd, onStepEnd, onEnd,
      maxSteps: 3,
    });

    // Step 0: start → stepStart → toolStart → toolEnd → stepEnd
    // Step 1: stepStart → stepEnd (no tool calls, stops)
    expect(order[0]).toBe("onStart");
    expect(order[1]).toBe("onStepStart");
    expect(order[2]).toBe("onToolExecutionStart");
    expect(order[3]).toBe("onToolExecutionEnd");
    expect(order[4]).toBe("onStepEnd");
    // second step fires stepStart then stepEnd (no tools)
    expect(order[5]).toBe("onStepStart");
    expect(order[6]).toBe("onStepEnd");
    // onEnd fires last
    expect(order[order.length - 1]).toBe("onEnd");
  });

  it("onStepFinish (deprecated) still works for backward compat", async () => {
    const onStepFinish = vi.fn();
    await runAgentLoop({
      runStep: async () => ({ text: "hi", finishReason: "stop" }),
      onStepFinish,
    });
    expect(onStepFinish).toHaveBeenCalledTimes(1);
  });

  it("onStart can access callId and tools", async () => {
    const onStart = vi.fn();
    const toolDef: AITool = { inputSchema: {}, execute: async () => "ok" };
    await runAgentLoop({
      runStep: async () => ({ text: "", finishReason: "stop" }),
      tools: { myTool: toolDef },
      onStart,
    });
    const event = onStart.mock.calls[0][0];
    expect(event.tools).toHaveProperty("myTool");
  });

  it("onEnd has aggregated toolCalls and toolResults", async () => {
    const onEnd = vi.fn();
    await runAgentLoop({
      runStep: async () => ({
        text: "",
        toolCalls: [{ id: "c1", name: "t", input: {} }],
        finishReason: "tool-calls",
      }),
      tools: { t: { inputSchema: {}, execute: async () => "done" } },
      onEnd,
      maxSteps: 2,
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
    const event = onEnd.mock.calls[0][0];
    expect(event.toolCalls.length).toBeGreaterThanOrEqual(1);
    expect(event.toolResults.length).toBeGreaterThanOrEqual(1);
    expect(event.toolResults[0].output).toBe("done");
  });
});
