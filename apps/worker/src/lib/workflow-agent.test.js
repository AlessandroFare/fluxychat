import { describe, expect, it } from "vitest";
import { createWorkflowAgent, createMemoryWorkflowStore } from "./workflow-agent.js";

describe("workflow-agent continue", () => {
  it("resumes and completes pending steps", async () => {
    const store = createMemoryWorkflowStore();
    const executed = [];

    const agent = createWorkflowAgent({
      store,
      executeStep: async (step) => {
        executed.push(step.id);
        return { done: step.id };
      },
    });

    const workflow = {
      id: "wf_test",
      name: "Test",
      steps: [
        { id: "s1", name: "Step 1", type: "tool_call", config: {}, status: "pending" },
        { id: "s2", name: "Step 2", type: "tool_call", config: {}, status: "pending", dependsOn: ["s1"] },
      ],
    };

    const initial = {
      workflowId: "wf_test",
      status: "paused",
      completedSteps: [],
      variables: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.save(initial);

    const finalState = await agent.continue(workflow, initial);
    expect(finalState.status).toBe("completed");
    expect(executed).toEqual(["s1", "s2"]);
  });
});
