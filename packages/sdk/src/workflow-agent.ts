/**
 * P23-6: WorkflowAgent
 * Durable execution with state machine for long-lived agent workflows.
 */

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
  /** Execute a workflow definition */
  execute(workflow: WorkflowDefinition, input?: Record<string, unknown>): Promise<WorkflowState>;
  /** Pause a running workflow */
  pause(workflowId: string): Promise<void>;
  /** Resume a paused workflow */
  resume(workflowId: string): Promise<void>;
  /** Cancel a workflow */
  cancel(workflowId: string): Promise<void>;
  /** Get workflow state */
  getState(workflowId: string): Promise<WorkflowState | null>;
  /** List workflows */
  listWorkflows(filter?: { status?: WorkflowStatus; limit?: number }): Promise<WorkflowState[]>;
}

export function createWorkflowAgent(opts: {
  store: WorkflowStore;
  executeStep: (step: WorkflowStep, state: WorkflowState) => Promise<unknown>;
  onStepComplete?: (step: WorkflowStep, state: WorkflowState) => void | Promise<void>;
  onWorkflowComplete?: (state: WorkflowState) => void | Promise<void>;
}): WorkflowAgent {
  throw new Error("createWorkflowAgent not implemented in SDK - use worker runtime");
}

export function createMemoryWorkflowStore(): WorkflowStore {
  throw new Error("createMemoryWorkflowStore not implemented in SDK - use worker runtime");
}
