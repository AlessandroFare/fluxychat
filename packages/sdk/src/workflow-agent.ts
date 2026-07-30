/** Durable, runtime-neutral workflow state machine. Persistence is delegated to WorkflowStore. */
export type WorkflowStatus = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";

export interface WorkflowStep {
  id: string;
  name: string;
  type: "llm_call" | "tool_call" | "human_approval" | "wait" | "condition" | "parallel";
  config: Record<string, unknown>;
  dependsOn?: string[];
  retryPolicy?: { maxRetries: number; backoffMs: number };
  timeoutMs?: number;
  status: StepStatus;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  variables?: Record<string, unknown>;
}

export interface WorkflowState {
  workflowId: string;
  status: WorkflowStatus;
  currentStepId?: string;
  completedSteps: string[];
  variables: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowStore {
  save(state: WorkflowState): Promise<void>;
  get(workflowId: string): Promise<WorkflowState | null>;
  list(filter?: { status?: WorkflowStatus; limit?: number }): Promise<WorkflowState[]>;
  delete(workflowId: string): Promise<void>;
}

export interface WorkflowAgent {
  execute(workflow: WorkflowDefinition, input?: Record<string, unknown>): Promise<WorkflowState>;
  pause(workflowId: string): Promise<void>;
  resume(workflowId: string): Promise<void>;
  cancel(workflowId: string): Promise<void>;
  getState(workflowId: string): Promise<WorkflowState | null>;
  listWorkflows(filter?: { status?: WorkflowStatus; limit?: number }): Promise<WorkflowState[]>;
}

export interface WorkflowAgentOptions {
  store: WorkflowStore;
  executeStep: (step: WorkflowStep, state: WorkflowState) => Promise<unknown>;
  onStepComplete?: (step: WorkflowStep, state: WorkflowState) => void | Promise<void>;
  onWorkflowComplete?: (state: WorkflowState) => void | Promise<void>;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertWorkflow(workflow: WorkflowDefinition): void {
  if (!workflow.id.trim()) throw new TypeError("workflow.id is required.");
  const ids = new Set<string>();
  for (const step of workflow.steps) {
    if (!step.id.trim() || ids.has(step.id)) throw new TypeError(`Duplicate or empty workflow step: ${step.id}`);
    ids.add(step.id);
  }
  for (const step of workflow.steps) {
    for (const dependency of step.dependsOn ?? []) {
      if (!ids.has(dependency)) throw new TypeError(`Unknown dependency ${dependency} for step ${step.id}.`);
    }
  }
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return operation;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Workflow step timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createWorkflowAgent(options: WorkflowAgentOptions): WorkflowAgent {
  const definitions = new Map<string, WorkflowDefinition>();
  const running = new Map<string, Promise<WorkflowState>>();
  const now = () => (options.now ?? (() => new Date()))().toISOString();
  const sleep = options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  async function persist(state: WorkflowState): Promise<void> {
    state.updatedAt = now();
    await options.store.save(clone(state));
  }

  async function run(workflow: WorkflowDefinition, state: WorkflowState): Promise<WorkflowState> {
    state.status = "running";
    await persist(state);
    const steps = workflow.steps.map(clone);
    try {
      while (state.completedSteps.length < steps.length) {
        const latest = await options.store.get(state.workflowId);
        if (latest?.status === "paused" || latest?.status === "cancelled") return latest;
        const runnable = steps.find((step) =>
          !state.completedSteps.includes(step.id) &&
          (step.dependsOn ?? []).every((dependency) => state.completedSteps.includes(dependency)),
        );
        if (!runnable) throw new Error("Workflow dependency graph is cyclic or blocked.");
        runnable.status = "running";
        runnable.startedAt = now();
        state.currentStepId = runnable.id;
        await persist(state);
        const retries = Math.max(0, runnable.retryPolicy?.maxRetries ?? 0);
        let result: unknown;
        let failure: unknown;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          try {
            result = await withTimeout(options.executeStep(clone(runnable), clone(state)), runnable.timeoutMs);
            failure = undefined;
            break;
          } catch (error) {
            failure = error;
            if (attempt < retries) await sleep(Math.max(0, runnable.retryPolicy?.backoffMs ?? 0) * 2 ** attempt);
          }
        }
        if (failure) throw failure;
        runnable.status = "completed";
        runnable.result = result;
        runnable.completedAt = now();
        state.completedSteps.push(runnable.id);
        state.variables[`step.${runnable.id}`] = result;
        state.currentStepId = undefined;
        await persist(state);
        await options.onStepComplete?.(clone(runnable), clone(state));
      }
      state.status = "completed";
      state.completedAt = now();
      await persist(state);
      await options.onWorkflowComplete?.(clone(state));
      return clone(state);
    } catch (error) {
      state.status = "failed";
      state.error = error instanceof Error ? error.message : String(error);
      state.currentStepId = undefined;
      await persist(state);
      return clone(state);
    } finally {
      running.delete(state.workflowId);
    }
  }

  const agent: WorkflowAgent = {
    async execute(workflow, input = {}) {
      assertWorkflow(workflow);
      if (running.has(workflow.id)) throw new Error(`Workflow ${workflow.id} is already running.`);
      definitions.set(workflow.id, clone(workflow));
      const timestamp = now();
      const state: WorkflowState = {
        workflowId: workflow.id,
        status: "idle",
        completedSteps: [],
        variables: { ...workflow.variables, ...input },
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const promise = run(workflow, state);
      running.set(workflow.id, promise);
      return promise;
    },
    async pause(workflowId) {
      const state = await options.store.get(workflowId);
      if (!state || state.status !== "running") throw new Error(`Workflow ${workflowId} is not running.`);
      state.status = "paused";
      await persist(state);
    },
    async resume(workflowId) {
      const state = await options.store.get(workflowId);
      const definition = definitions.get(workflowId);
      if (!state || state.status !== "paused" || !definition) throw new Error(`Workflow ${workflowId} cannot be resumed.`);
      if (running.has(workflowId)) return;
      const promise = run(definition, state);
      running.set(workflowId, promise);
      await promise;
    },
    async cancel(workflowId) {
      const state = await options.store.get(workflowId);
      if (!state || ["completed", "failed", "cancelled"].includes(state.status)) return;
      state.status = "cancelled";
      state.currentStepId = undefined;
      await persist(state);
    },
    getState: (workflowId) => options.store.get(workflowId),
    listWorkflows: (filter) => options.store.list(filter),
  };
  return agent;
}

export function createMemoryWorkflowStore(): WorkflowStore {
  const states = new Map<string, WorkflowState>();
  return {
    async save(state) { states.set(state.workflowId, clone(state)); },
    async get(workflowId) { const state = states.get(workflowId); return state ? clone(state) : null; },
    async list(filter = {}) {
      let values = [...states.values()];
      if (filter.status) values = values.filter((state) => state.status === filter.status);
      values.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return values.slice(0, filter.limit ?? values.length).map(clone);
    },
    async delete(workflowId) { states.delete(workflowId); },
  };
}
