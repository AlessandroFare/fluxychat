import { FluxyAIError, addUsage, type AIGenerationStep, type AIUsage } from "./ai-core";

export interface AIToolContext<TContext = unknown> {
  signal: AbortSignal;
  step: number;
  /** Shared orchestration context. Never serialize this value into a model prompt. */
  runtime?: unknown;
  /** Tool-specific, validated context such as scoped credentials or service handles. */
  tool?: TContext;
}

export interface AITool<Input = unknown, Output = unknown, TContext = unknown> {
  description?: string;
  inputSchema: Record<string, unknown>;
  /** Refine parsed model input before approval and execution. */
  refineInput?: (input: unknown, context: AIToolContext<TContext>) => Input | Promise<Input>;
  needsApproval?: (input: Input, context: AIToolContext<TContext>) => boolean | Promise<boolean>;
  execute(input: Input, context: AIToolContext<TContext>): Output | Promise<Output>;
}

export interface AIToolCall { id: string; name: string; input: unknown }
export interface AIToolResult { id: string; name: string; output?: unknown; error?: FluxyAIError }
export interface AgentStepResult {
  text: string;
  toolCalls?: readonly AIToolCall[];
  usage?: AIUsage;
  finishReason?: AIGenerationStep["finishReason"];
}
export interface AgentLoopState {
  step: number;
  steps: readonly AIGenerationStep[];
  toolResults: readonly AIToolResult[];
  usage: AIUsage;
  runtime?: unknown;
}
export type AgentStopCondition = (state: AgentLoopState, latest: AgentStepResult) => boolean | Promise<boolean>;

export interface AgentLoopOptions {
  tools?: Record<string, AITool>;
  maxSteps?: number;
  maxToolCalls?: number;
  signal?: AbortSignal;
  runtime?: unknown;
  /** Context is selected per tool and is never exposed to runStep/model input. */
  toolContexts?: Readonly<Record<string, unknown>>;
  toolTimeoutMs?: number;
  allowTools?: readonly string[];
  prepareStep?: (state: AgentLoopState) => void | Promise<void>;
  runStep: (state: AgentLoopState) => AgentStepResult | Promise<AgentStepResult>;
  stopWhen?: AgentStopCondition | readonly AgentStopCondition[];
  onApprovalRequired?: (call: AIToolCall, context: AIToolContext) => Promise<boolean>;
  onStepFinish?: (state: AgentLoopState, latest: AgentStepResult) => void | Promise<void>;
}

export interface AgentLoopResult extends AgentLoopState { text: string }

export const stopAfterSteps = (count: number): AgentStopCondition =>
  (state) => state.step >= Math.max(1, Math.floor(count));
export const stopOnFinishReason = (...reasons: AIGenerationStep["finishReason"][]): AgentStopCondition =>
  (_state, latest) => latest.finishReason !== undefined && reasons.includes(latest.finishReason);

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const maxSteps = Math.max(1, Math.floor(options.maxSteps ?? 10));
  const maxToolCalls = Math.max(0, Math.floor(options.maxToolCalls ?? 50));
  const conditions = options.stopWhen ? (Array.isArray(options.stopWhen) ? options.stopWhen : [options.stopWhen]) : [];
  const allowed = options.allowTools ? new Set(options.allowTools) : null;
  const steps: AIGenerationStep[] = [];
  const toolResults: AIToolResult[] = [];
  const executed = new Set<string>();
  let usage: AIUsage = {};
  let text = "";
  let toolCallCount = 0;

  for (let index = 0; index < maxSteps; index += 1) {
    if (options.signal?.aborted) throw options.signal.reason;
    const before: AgentLoopState = { step: index, steps, toolResults, usage, runtime: options.runtime };
    await options.prepareStep?.(before);
    const latest = await options.runStep(before);
    usage = addUsage(usage, latest.usage);
    text += latest.text;
    const step: AIGenerationStep = {
      step: index,
      text: latest.text,
      usage: latest.usage ?? {},
      finishReason: latest.finishReason ?? "unknown",
    };
    steps.push(step);

    for (const call of latest.toolCalls ?? []) {
      if (executed.has(call.id)) continue;
      executed.add(call.id);
      toolCallCount += 1;
      if (toolCallCount > maxToolCalls) throw new FluxyAIError({ code: "tool_error", message: "Agent tool-call budget exceeded.", retryable: false });
      const tool = options.tools?.[call.name];
      if (!tool || (allowed && !allowed.has(call.name))) {
        toolResults.push({ id: call.id, name: call.name, error: new FluxyAIError({ code: "tool_error", message: `Tool is not allowed: ${call.name}`, retryable: false }) });
        continue;
      }
      const toolController = new AbortController();
      const abortTool = () => toolController.abort(options.signal?.reason);
      if (options.signal?.aborted) abortTool();
      else options.signal?.addEventListener("abort", abortTool, { once: true });
      const timeoutMs = Math.max(0, options.toolTimeoutMs ?? 30_000);
      const timer = timeoutMs > 0 ? setTimeout(() => toolController.abort(new FluxyAIError({
        code: "timeout", message: `Tool timed out: ${call.name}`, retryable: true,
      })), timeoutMs) : undefined;
      const context: AIToolContext = {
        signal: toolController.signal,
        step: index,
        runtime: options.runtime,
        tool: options.toolContexts?.[call.name],
      };
      try {
        const refinedInput = tool.refineInput ? await tool.refineInput(call.input, context) : call.input;
        const refinedCall = { ...call, input: refinedInput };
        if (await tool.needsApproval?.(refinedInput, context)) {
          const approved = await options.onApprovalRequired?.(refinedCall, context);
          if (!approved) throw new FluxyAIError({ code: "tool_error", message: `Tool approval denied: ${call.name}`, retryable: false });
        }
        toolResults.push({ id: call.id, name: call.name, output: await tool.execute(refinedInput, context) });
      } catch (error) {
        const reason = toolController.signal.aborted ? toolController.signal.reason : error;
        toolResults.push({ id: call.id, name: call.name, error: reason instanceof FluxyAIError ? reason : new FluxyAIError({ code: "tool_error", message: reason instanceof Error ? reason.message : "Tool execution failed.", retryable: false, cause: reason }) });
      } finally {
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener("abort", abortTool);
      }
    }

    const state: AgentLoopState = { step: index + 1, steps, toolResults, usage, runtime: options.runtime };
    await options.onStepFinish?.(state, latest);
    if ((conditions.length && (await Promise.all(conditions.map((condition) => condition(state, latest)))).some(Boolean)) || (!latest.toolCalls?.length && latest.finishReason !== "tool-calls")) {
      return { ...state, text };
    }
  }
  return { step: maxSteps, steps, toolResults, usage, runtime: options.runtime, text };
}
