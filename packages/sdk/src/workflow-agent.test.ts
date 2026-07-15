import { describe, expect, it, vi } from "vitest";
import { createMemoryWorkflowStore, createWorkflowAgent, type WorkflowDefinition } from "./workflow-agent";

const workflow = (): WorkflowDefinition => ({
  id: "run-1",
  name: "research",
  steps: [
    { id: "collect", name: "Collect", type: "tool_call", config: {}, status: "pending" },
    { id: "summarize", name: "Summarize", type: "llm_call", config: {}, dependsOn: ["collect"], status: "pending" },
  ],
});

describe("WorkflowAgent", () => {
  it("executes dependencies and persists results", async () => {
    const store = createMemoryWorkflowStore();
    const executeStep = vi.fn(async (step) => `${step.id}-result`);
    const agent = createWorkflowAgent({ store, executeStep });
    const result = await agent.execute(workflow(), { input: "topic" });
    expect(result.status).toBe("completed");
    expect(result.completedSteps).toEqual(["collect", "summarize"]);
    expect(result.variables["step.collect"]).toBe("collect-result");
    expect(executeStep.mock.calls.map(([step]) => step.id)).toEqual(["collect", "summarize"]);
  });

  it("retries with backoff then succeeds", async () => {
    const store = createMemoryWorkflowStore();
    const sleep = vi.fn().mockResolvedValue(undefined);
    const executeStep = vi.fn().mockRejectedValueOnce(new Error("transient")).mockResolvedValue("ok");
    const definition = workflow();
    definition.steps = [{ id: "retry", name: "Retry", type: "tool_call", config: {}, status: "pending", retryPolicy: { maxRetries: 1, backoffMs: 10 } }];
    const result = await createWorkflowAgent({ store, executeStep, sleep }).execute(definition);
    expect(result.status).toBe("completed");
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("persists a failed state for a blocked graph", async () => {
    const store = createMemoryWorkflowStore();
    const definition: WorkflowDefinition = {
      id: "blocked",
      name: "Blocked",
      steps: [
        { id: "a", name: "A", type: "wait", config: {}, status: "pending", dependsOn: ["b"] },
        { id: "b", name: "B", type: "wait", config: {}, status: "pending", dependsOn: ["a"] },
      ],
    };
    const result = await createWorkflowAgent({ store, executeStep: vi.fn() }).execute(definition);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/cyclic|blocked/);
  });
});
