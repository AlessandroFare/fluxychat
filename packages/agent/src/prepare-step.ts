import type { AgentLoopState, AIToolResult } from "./agent-loop";
import type { ToolApprovalConfig } from "./tool-approval";

export interface PrepareStepContext {
  stepNumber: number;
  steps: AgentLoopState["steps"];
  toolResults: readonly AIToolResult[];
  state: AgentLoopState;
  runtime: unknown | undefined;
  providerOptions?: Record<string, unknown>;
}

export interface PrepareStepResult {
  allowTools?: readonly string[];
  runtime?: unknown;
  toolContexts?: Readonly<Record<string, unknown>>;
  toolApproval?: ToolApprovalConfig;
  providerOptions?: Record<string, unknown>;
}

export type PrepareStepFunction = (
  context: PrepareStepContext,
) => PrepareStepResult | Promise<PrepareStepResult> | void | Promise<void>;
