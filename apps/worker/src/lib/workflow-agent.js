/**
 * P23-6: WorkflowAgent — Worker Implementation
 * Durable execution with state machine for long-lived agent workflows.
 */

/**
 * Create a workflow agent with durable execution.
 * @param {Object} opts
 */
export function createWorkflowAgent({ store, executeStep, onStepComplete, onWorkflowComplete }) {
  function getNextSteps(state, workflow) {
    const completedSet = new Set(state.completedSteps);
    return workflow.steps.filter((step) => {
      if (completedSet.has(step.id)) return false;
      if (step.status === "completed" || step.status === "running") return false;
      if (step.dependsOn?.length) {
        return step.dependsOn.every((dep) => completedSet.has(dep));
      }
      return true;
    });
  }

  async function processWorkflow(workflow, state) {
    while (true) {
      if (state.status === "paused" || state.status === "cancelled" || state.status === "failed") {
        break;
      }

      const nextSteps = getNextSteps(state, workflow);
      if (nextSteps.length === 0) {
        state.status = "completed";
        state.completedAt = new Date().toISOString();
        break;
      }

      const step = nextSteps[0];
      state.currentStepId = step.id;
      step.status = "running";
      step.startedAt = new Date().toISOString();
      state.updatedAt = new Date().toISOString();
      await store.save(state);

      try {
        // Handle timeout
        let result;
        if (step.timeoutMs) {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Step "${step.name}" timed out after ${step.timeoutMs}ms`)), step.timeoutMs)
          );
          result = await Promise.race([executeStep(step, state), timeoutPromise]);
        } else {
          result = await executeStep(step, state);
        }

        step.status = "completed";
        step.result = result;
        step.completedAt = new Date().toISOString();
        state.completedSteps.push(step.id);
        state.variables = { ...state.variables, [step.id]: result };

        if (onStepComplete) {
          await onStepComplete(step, state);
        }
      } catch (err) {
        step.status = "failed";
        step.error = err.message;
        step.completedAt = new Date().toISOString();

        // Retry logic
        if (step.retryPolicy && step.retryAttempts < step.retryPolicy.maxRetries) {
          step.retryAttempts = (step.retryAttempts || 0) + 1;
          step.status = "pending";
          const backoff = step.retryPolicy.backoffMs * Math.pow(2, step.retryAttempts - 1);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        state.status = "failed";
        state.error = `Step "${step.name}" failed: ${err.message}`;
        break;
      }

      await store.save(state);
    }

    if (onWorkflowComplete) {
      await onWorkflowComplete(state);
    }
    await store.save(state);
    return state;
  }

  return {
    async execute(workflow, input = {}) {
      const state = {
        workflowId: workflow.id,
        status: "running",
        completedSteps: [],
        variables: { ...workflow.variables, ...input },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await store.save(state);
      return processWorkflow(workflow, state);
    },

    async pause(workflowId) {
      const state = await store.get(workflowId);
      if (!state) throw new Error("Workflow not found");
      if (state.status !== "running") throw new Error("Workflow is not running");
      state.status = "paused";
      state.updatedAt = new Date().toISOString();
      await store.save(state);
    },

    async resume(workflowId) {
      const state = await store.get(workflowId);
      if (!state) throw new Error("Workflow not found");
      if (state.status !== "paused") throw new Error("Workflow is not paused");
      state.status = "running";
      state.updatedAt = new Date().toISOString();
      await store.save(state);
      return state;
    },

    /** CP-071: Continue execution from persisted state (resume after restart). */
    async continue(workflow, state) {
      if (!state) throw new Error("Workflow state required");
      if (state.status === "completed" || state.status === "cancelled") {
        return state;
      }
      state.status = "running";
      state.updatedAt = new Date().toISOString();
      await store.save(state);
      return processWorkflow(workflow, state);
    },

    async cancel(workflowId) {
      const state = await store.get(workflowId);
      if (!state) throw new Error("Workflow not found");
      state.status = "cancelled";
      state.updatedAt = new Date().toISOString();
      state.completedAt = new Date().toISOString();
      await store.save(state);
    },

    async getState(workflowId) {
      return store.get(workflowId);
    },

    async listWorkflows(filter) {
      return store.list(filter);
    },
  };
}

/**
 * Create an in-memory workflow store.
 */
export function createMemoryWorkflowStore() {
  const store = new Map();

  return {
    async save(state) {
      store.set(state.workflowId, JSON.parse(JSON.stringify(state)));
    },

    async get(workflowId) {
      const state = store.get(workflowId);
      return state ? JSON.parse(JSON.stringify(state)) : null;
    },

    async list(filter = {}) {
      let states = [...store.values()];
      if (filter.status) {
        states = states.filter((s) => s.status === filter.status);
      }
      if (filter.limit) {
        states = states.slice(0, filter.limit);
      }
      return states.map((s) => JSON.parse(JSON.stringify(s)));
    },

    async delete(workflowId) {
      store.delete(workflowId);
    },
  };
}
