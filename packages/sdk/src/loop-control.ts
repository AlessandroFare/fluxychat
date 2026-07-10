/**
 * P24-2: Multi-step Loop Control
 * Configurable stop conditions for agent loops.
 */

export type StepCountFn = (step: number) => boolean;
export type HasToolCallFn = (toolCalls: Array<{ name: string }>) => boolean;
export type IsLoopFinishedFn = (context: LoopContext) => boolean;

export interface LoopContext {
  step: number;
  maxSteps: number;
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  toolResults: Array<{ toolCallId: string; result: unknown; success: boolean }>;
  totalTokens: { input: number; output: number };
  startTime: number;
}

export interface LoopControlConfig {
  /** Maximum number of steps (default: 10) */
  maxSteps?: number;
  /** Stop when this many steps have been taken */
  stopWhenStepCount?: number;
  /** Stop when any of these tool names are called */
  stopWhenToolCalled?: string[];
  /** Stop when all of these tool names have been called at least once */
  stopWhenAllToolsCalled?: string[];
  /** Custom stop condition function */
  stopWhen?: IsLoopFinishedFn;
  /** Whether to include tool results in the next LLM call (default: true) */
  includeToolResults?: boolean;
  /** Maximum total tokens across all steps */
  maxTotalTokens?: number;
  /** Maximum time in milliseconds */
  maxTimeMs?: number;
}

export interface LoopController {
  /** Check if the loop should continue */
  shouldContinue(context: LoopContext): boolean;
  /** Get the reason why the loop stopped */
  getStopReason(context: LoopContext): string;
  /** Get current step count */
  getStepCount(): number;
  /** Increment step counter */
  nextStep(): void;
}

export function createLoopController(config?: LoopControlConfig): LoopController {
  throw new Error("createLoopController not implemented in SDK - use worker runtime");
}

/**
 * Default loop control config for different presets.
 */
export const LOOP_PRESETS: {
  /** Simple one-shot: single step, no tool calls */
  singleStep: LoopControlConfig;
  /** Standard agent: up to 10 steps, stops on certain tools */
  standard: LoopControlConfig;
  /** Deep research: up to 25 steps, stops on completion */
  deepResearch: LoopControlConfig;
  /** Autonomous: up to 50 steps, stops only on custom conditions */
  autonomous: LoopControlConfig;
} = {} as any;
