import type { AIToolCall, AIToolResult, AgentStepResult, AgentLoopState } from "./agent-loop";
import type { AIFinishReason, AIUsage } from "./ai-core";

/** Event passed to `onStart`. Called once before any steps run. */
export interface LoopStartEvent {
  readonly callId: string;
  readonly tools: Readonly<Record<string, unknown>> | undefined;
  readonly maxSteps: number;
  readonly runtime: unknown | undefined;
}

/** Event passed to `onStepStart`. Called before each step. */
export interface StepStartEvent {
  readonly callId: string;
  readonly stepNumber: number;
  readonly state: AgentLoopState;
}

/** Event passed to `onToolExecutionStart`. Called before tool.execute(). */
export interface ToolExecutionStartEvent {
  readonly callId: string;
  readonly stepNumber: number;
  readonly toolCall: AIToolCall;
  /** Tool-specific context from toolContexts, or undefined. */
  readonly toolContext: unknown | undefined;
}

/** Event passed to `onToolExecutionEnd`. Called after tool.execute() completes or errors. */
export interface ToolExecutionEndEvent {
  readonly callId: string;
  readonly stepNumber: number;
  readonly toolCall: AIToolCall;
  readonly toolContext: unknown | undefined;
  readonly toolExecutionMs: number;
  readonly output: unknown | undefined;
  readonly error: unknown;
  readonly approval: AIToolResult["approval"];
}

/** Event passed to `onStepEnd`. Called after each step completes. */
export interface StepEndEvent {
  readonly callId: string;
  readonly stepNumber: number;
  readonly text: string;
  readonly toolCalls: readonly AIToolCall[];
  readonly toolResults: readonly AIToolResult[];
  readonly finishReason: AIFinishReason;
  readonly usage: AIUsage;
  readonly state: AgentLoopState;
}

/** Event passed to `onEnd`. Called once when the loop finishes. */
export interface LoopEndEvent {
  readonly callId: string;
  readonly text: string;
  readonly toolCalls: readonly AIToolCall[];
  readonly toolResults: readonly AIToolResult[];
  readonly finishReason: AIFinishReason;
  readonly usage: AIUsage;
  steps: AgentLoopState["steps"];
  readonly finalState: AgentLoopState;
}

export type Callback<T> = (event: T) => void | Promise<void>;
