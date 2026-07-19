import { describe, it, expect } from "vitest";
import { createSubagentTool, runSubagent } from "./subagent";
import { runAgentLoop, type AITool } from "./agent-loop";
import { DeterministicLanguageModel } from "./providers";

describe("createSubagentTool", () => {
  it("creates an AITool with description and schema", () => {
    const tool = createSubagentTool({
      description: "Research a topic",
      inputSchema: { type: "object", properties: { task: { type: "string" } } },
      subagent: {
        runStep: async () => ({ text: "research result", finishReason: "stop" }),
      },
    });
    expect(tool.description).toBe("Research a topic");
    expect(tool.inputSchema).toEqual({ type: "object", properties: { task: { type: "string" } } });
  });

  it("executes subagent loop and returns result", async () => {
    const tool = createSubagentTool({
      description: "Research",
      inputSchema: { type: "object", properties: { task: { type: "string" } } },
      subagent: {
        runStep: async () => ({ text: "research findings", finishReason: "stop" }),
      },
    });
    const result = await tool.execute({ task: "test" }, {
      signal: new AbortController().signal,
      step: 0,
    });
    expect(result).toBe("research findings");
  });

  it("uses toModelOutput to transform result", async () => {
    const tool = createSubagentTool({
      description: "Research",
      inputSchema: { type: "object", properties: { task: { type: "string" } } },
      subagent: {
        runStep: async () => ({ text: "detailed analysis results", finishReason: "stop" }),
      },
      toModelOutput: (result) => ({ summary: result.text }),
    });
    const result = await tool.execute({ task: "test" }, {
      signal: new AbortController().signal,
      step: 0,
    });
    expect(result).toEqual({ summary: "detailed analysis results" });
  });

  it("passes input as subagentTask in runtime", async () => {
    let capturedRuntime: unknown;
    const tool = createSubagentTool({
      description: "Research",
      inputSchema: { type: "object", properties: { task: { type: "string" } } },
      subagent: {
        runStep: async (state) => {
          capturedRuntime = state.runtime;
          return { text: "done", finishReason: "stop" };
        },
      },
    });
    await tool.execute({ task: "hello" }, {
      signal: new AbortController().signal,
      step: 0,
    });
    expect(capturedRuntime).toEqual({ subagentTask: { task: "hello" } });
  });
});

describe("runSubagent", () => {
  it("runs a subagent with prompt and returns result", async () => {
    const result = await runSubagent(
      {
        runStep: async (state) => {
          const task = (state.runtime as Record<string, string>)?.prompt ?? "";
          return { text: `processed: ${task}`, finishReason: "stop" };
        },
      },
      "analyze data",
    );
    expect(result.text).toBe("processed: analyze data");
    expect(result.steps).toBeDefined();
    expect(result.usage).toBeDefined();
  });

  it("passes system instruction in runtime", async () => {
    const result = await runSubagent(
      {
        runStep: async (state) => {
          const sys = (state.runtime as Record<string, string>)?.system ?? "";
          return { text: `system: ${sys}`, finishReason: "stop" };
        },
      },
      "do work",
      { system: "You are helpful" },
    );
    expect(result.text).toBe("system: You are helpful");
  });
});
