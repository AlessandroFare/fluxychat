import { FluxyAIError } from "./ai-core";
import {
  runAgentLoop,
  type AITool,
  type AIToolContext,
  type AgentLoopOptions,
  type AgentLoopResult,
  type AgentStopCondition,
} from "./agent-loop";
import type { ToolApprovalConfig } from "./tool-approval";

export interface SubagentConfig {
  runStep: AgentLoopOptions["runStep"];
  tools?: Record<string, AITool>;
  maxSteps?: number;
  maxToolCalls?: number;
  toolTimeoutMs?: number;
  allowTools?: readonly string[];
  stopWhen?: AgentStopCondition | readonly AgentStopCondition[];
  toolApproval?: ToolApprovalConfig;
  toolApprovalSecret?: string | Uint8Array;
  onApprovalRequired?: AgentLoopOptions["onApprovalRequired"];
  onStart?: AgentLoopOptions["onStart"];
  onToolExecutionStart?: AgentLoopOptions["onToolExecutionStart"];
  onToolExecutionEnd?: AgentLoopOptions["onToolExecutionEnd"];
  onStepEnd?: AgentLoopOptions["onStepEnd"];
  onEnd?: AgentLoopOptions["onEnd"];
}

export interface SubagentToolOptions<
  TInput,
  TOutput = unknown,
> {
  description: string;
  inputSchema: Record<string, unknown>;
  subagent: SubagentConfig;
  toModelOutput?: (result: AgentLoopResult) => TOutput | Promise<TOutput>;
  signal?: AbortSignal;
}

export interface SubagentResult {
  text: string;
  steps: AgentLoopResult["steps"];
  toolResults: AgentLoopResult["toolResults"];
  usage: AgentLoopResult["usage"];
}

export function createSubagentTool<
  TInput = unknown,
  TOutput = unknown,
>(
  options: SubagentToolOptions<TInput, TOutput>,
): AITool<TInput, TOutput> {
  return {
    description: options.description,
    inputSchema: options.inputSchema,
    async execute(
      input: TInput,
      context: AIToolContext,
    ): Promise<TOutput> {
      const subRuntime: Record<string, unknown> = {
        subagentTask: input,
      };
      if (context.runtime) {
        Object.assign(subRuntime, context.runtime as Record<string, unknown>);
      }
      const result = await runAgentLoop({
        ...options.subagent,
        signal: context.signal,
        runtime: subRuntime,
      });
      if (options.toModelOutput) {
        return options.toModelOutput(result);
      }
      return result.text as unknown as TOutput;
    },
  };
}

/**
 * Runs a subagent synchronously (no streaming to UI).
 * Returns the final text result.
 */
export async function runSubagent(
  config: SubagentConfig,
  prompt: string,
  options?: {
    signal?: AbortSignal;
    runtime?: unknown;
    system?: string;
  },
): Promise<SubagentResult> {
  const result = await runAgentLoop({
    runStep: config.runStep,
    tools: config.tools,
    maxSteps: config.maxSteps,
    maxToolCalls: config.maxToolCalls,
    toolTimeoutMs: config.toolTimeoutMs,
    allowTools: config.allowTools,
    stopWhen: config.stopWhen,
    toolApproval: config.toolApproval,
    toolApprovalSecret: config.toolApprovalSecret,
    onApprovalRequired: config.onApprovalRequired,
    onStart: config.onStart,
    onToolExecutionStart: config.onToolExecutionStart,
    onToolExecutionEnd: config.onToolExecutionEnd,
    onStepEnd: config.onStepEnd,
    onEnd: config.onEnd,
    signal: options?.signal,
    runtime: options?.runtime,
    prepareStep: async (ctx) => {
      const state = ctx.state;
      const messages = state.steps
        .flatMap((s) => [
          { role: "assistant" as const, content: s.text },
        ]);
      const mergedRuntime: Record<string, unknown> = { prompt, system: options?.system, messages };
      if (state.runtime) {
        Object.assign(mergedRuntime, state.runtime as Record<string, unknown>);
      }
      return { runtime: mergedRuntime };
    },
  });
  return {
    text: result.text,
    steps: result.steps,
    toolResults: result.toolResults,
    usage: result.usage,
  };
}
