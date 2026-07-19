import { FluxyAIError, addUsage, type AIGenerationStep, type AIUsage } from "./ai-core";
import {
  resolveToolApproval,
  signApproval,
  verifyApprovalSignature,
  createApprovalId,
  type ToolApprovalConfig,
  type ApprovalRequest,
  type ApprovalResponse,
  type ToolApprovalRecord,
} from "./tool-approval";
import type {
  Callback,
  LoopStartEvent,
  StepStartEvent,
  ToolExecutionStartEvent,
  ToolExecutionEndEvent,
  StepEndEvent,
  LoopEndEvent,
} from "./lifecycle-events";
import type { PrepareStepFunction, PrepareStepResult } from "./prepare-step";

export interface AIToolContext<TContext = unknown> {
  signal: AbortSignal;
  step: number;
  runtime?: unknown;
  tool?: TContext;
}

export interface AITool<Input = unknown, Output = unknown, TContext = unknown> {
  description?: string;
  inputSchema: Record<string, unknown>;
  refineInput?: (input: unknown, context: AIToolContext<TContext>) => Input | Promise<Input>;
  needsApproval?: (input: Input, context: AIToolContext<TContext>) => boolean | Promise<boolean>;
  execute(input: Input, context: AIToolContext<TContext>): Output | Promise<Output>;
}

export interface AIToolCall { id: string; name: string; input: unknown; approval?: ApprovalRequest }
export interface AIToolResult {
  id: string;
  name: string;
  output?: unknown;
  error?: FluxyAIError;
  approval?: ToolApprovalRecord;
}
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
  providerOptions?: Record<string, unknown>;
}
export type AgentStopCondition = (state: AgentLoopState, latest: AgentStepResult) => boolean | Promise<boolean>;

export interface AgentLoopOptions {
  tools?: Record<string, AITool>;
  maxSteps?: number;
  maxToolCalls?: number;
  signal?: AbortSignal;
  runtime?: unknown;
  toolContexts?: Readonly<Record<string, unknown>>;
  providerOptions?: Record<string, unknown>;
  toolTimeoutMs?: number;
  allowTools?: readonly string[];
  prepareStep?: PrepareStepFunction;
  runStep: (state: AgentLoopState) => AgentStepResult | Promise<AgentStepResult>;
  stopWhen?: AgentStopCondition | readonly AgentStopCondition[];
  toolApproval?: ToolApprovalConfig;
  toolApprovalSecret?: string | Uint8Array;
  onApprovalRequired?: (call: AIToolCall, context: AIToolContext) => Promise<boolean>;

  // ── Lifecycle callbacks ──
  onStart?: Callback<LoopStartEvent>;
  onStepStart?: Callback<StepStartEvent>;
  onToolExecutionStart?: Callback<ToolExecutionStartEvent>;
  onToolExecutionEnd?: Callback<ToolExecutionEndEvent>;
  onStepEnd?: Callback<StepEndEvent>;
  onEnd?: Callback<LoopEndEvent>;

  /** @deprecated Use onStepEnd instead. */
  onStepFinish?: (state: AgentLoopState, latest: AgentStepResult) => void | Promise<void>;
}

export interface AgentLoopResult extends AgentLoopState { text: string }

let callCounter = 0;
function generateCallId(): string {
  callCounter += 1;
  return `call_${Date.now()}_${callCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export const stopAfterSteps = (count: number): AgentStopCondition =>
  (state) => state.step >= Math.max(1, Math.floor(count));
export const stopOnFinishReason = (...reasons: AIGenerationStep["finishReason"][]): AgentStopCondition =>
  (_state, latest) => latest.finishReason !== undefined && reasons.includes(latest.finishReason);

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const maxSteps = Math.max(1, Math.floor(options.maxSteps ?? 10));
  const maxToolCalls = Math.max(0, Math.floor(options.maxToolCalls ?? 50));
  const conditions = options.stopWhen ? (Array.isArray(options.stopWhen) ? options.stopWhen : [options.stopWhen]) : [];
  const callId = generateCallId();
  const steps: AIGenerationStep[] = [];
  const toolResults: AIToolResult[] = [];
  const executed = new Set<string>();
  let usage: AIUsage = {};
  let text = "";
  let toolCallCount = 0;
  const allToolCalls: AIToolCall[] = [];
  let lastFinishReason: AIGenerationStep["finishReason"] | undefined;
  let mutableRuntime = options.runtime;
  let mutableAllowTools = options.allowTools;
  let mutableToolContexts = options.toolContexts;
  let mutableToolApproval = options.toolApproval;
  let mutableProviderOptions = options.providerOptions;

  await options.onStart?.({
    callId,
    tools: options.tools as Readonly<Record<string, unknown>> | undefined,
    maxSteps,
    runtime: options.runtime,
  });

  for (let index = 0; index < maxSteps; index += 1) {
    if (options.signal?.aborted) throw options.signal.reason;
    const stepResults = [...toolResults];
    const before: AgentLoopState = { step: index, steps, toolResults, usage, runtime: mutableRuntime, providerOptions: mutableProviderOptions };
    await options.onStepStart?.({ callId, stepNumber: index, state: before });
    const prepareResult = await options.prepareStep?.({
      stepNumber: index,
      steps,
      toolResults,
      state: before,
      runtime: mutableRuntime,
      providerOptions: mutableProviderOptions,
    });
    if (prepareResult) {
      if (prepareResult.allowTools !== undefined) mutableAllowTools = prepareResult.allowTools;
      if (prepareResult.runtime !== undefined) mutableRuntime = prepareResult.runtime;
      if (prepareResult.toolContexts !== undefined) mutableToolContexts = prepareResult.toolContexts;
      if (prepareResult.toolApproval !== undefined) mutableToolApproval = prepareResult.toolApproval;
      if (prepareResult.providerOptions !== undefined) mutableProviderOptions = prepareResult.providerOptions;
    }
    const latest = await options.runStep({
      step: index, steps, toolResults, usage, runtime: mutableRuntime, providerOptions: mutableProviderOptions,
    });
    lastFinishReason = latest.finishReason ?? "unknown";
    usage = addUsage(usage, latest.usage);
    text += latest.text;
    const step: AIGenerationStep = {
      step: index,
      text: latest.text,
      usage: latest.usage ?? {},
      finishReason: lastFinishReason,
    };
    steps.push(step);

    for (const call of latest.toolCalls ?? []) {
      if (executed.has(call.id)) continue;
      executed.add(call.id);
      toolCallCount += 1;
      if (toolCallCount > maxToolCalls) throw new FluxyAIError({ code: "tool_error", message: "Agent tool-call budget exceeded.", retryable: false });
      allToolCalls.push({ id: call.id, name: call.name, input: call.input });
      const tool = options.tools?.[call.name];
      const allowedSet = mutableAllowTools ? new Set(mutableAllowTools) : null;
      if (!tool || (allowedSet && !allowedSet.has(call.name))) {
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
        runtime: mutableRuntime,
        tool: mutableToolContexts?.[call.name],
      };
      try {
        const refinedInput = tool.refineInput ? await tool.refineInput(call.input, context) : call.input;
        const refinedCall = { ...call, input: refinedInput };
        const approvalStatus = await resolveToolApproval(
          mutableToolApproval,
          refinedCall,
          { runtime: mutableRuntime },
        );
        await options.onToolExecutionStart?.({ callId, stepNumber: index, toolCall: refinedCall, toolContext: mutableToolContexts?.[call.name] });
        const toolStart = performance.now();
        let finalOutput: unknown | undefined;
        let finalError: FluxyAIError | undefined;
        let finalApproval: AIToolResult["approval"];

        // ── approval switch ──
        let shouldExecute = false;
        if (approvalStatus.type === "denied") {
          finalError = new FluxyAIError({ code: "tool_error", message: `Tool "${call.name}" denied: ${approvalStatus.reason ?? "No reason provided"}`, retryable: false });
          finalApproval = { status: "denied", reason: approvalStatus.reason };
        } else if (approvalStatus.type === "user-approval") {
          let signed: ApprovalRequest | undefined;
          if (options.toolApprovalSecret) {
            const signature = await signApproval({
              secret: options.toolApprovalSecret,
              approvalId: createApprovalId(),
              toolCallId: call.id, toolName: call.name,
              input: refinedInput,
            });
            signed = {
              type: "tool-approval-request",
              approvalId: createApprovalId(),
              toolCallId: call.id, toolName: call.name,
              input: refinedInput, signature,
            };
          }
          const approved = await options.onApprovalRequired?.(
            { ...refinedCall, approval: signed },
            context,
          );
          if (signed && options.toolApprovalSecret && approved) {
            const valid = await verifyApprovalSignature({
              secret: options.toolApprovalSecret,
              signature: signed.signature!,
              approvalId: signed.approvalId,
              toolCallId: signed.toolCallId,
              toolName: signed.toolName,
              input: refinedInput,
            });
            if (!valid) throw new FluxyAIError({ code: "tool_error", message: `Tool approval signature verification failed: ${call.name}`, retryable: false });
          }
          if (approved) {
            shouldExecute = true;
          } else {
            finalError = new FluxyAIError({ code: "tool_error", message: `Tool approval denied by user: ${call.name}`, retryable: false });
            finalApproval = { status: "denied", reason: "Denied by user" };
          }
        } else if (approvalStatus.type === "approved") {
          shouldExecute = true;
        } else {
          // not-applicable – fallback to legacy needsApproval
          const legacyNeedsApproval = await tool.needsApproval?.(refinedInput, context);
          if (legacyNeedsApproval) {
            const approved = await options.onApprovalRequired?.(refinedCall, context);
            if (!approved) throw new FluxyAIError({ code: "tool_error", message: `Tool approval denied: ${call.name}`, retryable: false });
          }
          shouldExecute = true;
        }

        if (shouldExecute) {
          try {
            finalOutput = await tool.execute(refinedInput, context);
          } catch (execError) {
            finalError = execError instanceof FluxyAIError ? execError : new FluxyAIError({
              code: "tool_error", message: execError instanceof Error ? execError.message : "Tool execution failed.", retryable: false, cause: execError,
            });
          }
        }
        const toolExecutionMs = performance.now() - toolStart;
        const toolResult: AIToolResult = {
          id: call.id, name: call.name,
          output: finalOutput,
          error: finalError,
          approval: finalApproval,
        };
        toolResults.push(toolResult);
        await options.onToolExecutionEnd?.({ callId, stepNumber: index, toolCall: refinedCall, toolContext: mutableToolContexts?.[call.name], toolExecutionMs, output: finalOutput, error: finalError, approval: finalApproval });
      } finally {
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener("abort", abortTool);
      }
    }

    const state: AgentLoopState = { step: index + 1, steps, toolResults, usage, runtime: mutableRuntime, providerOptions: mutableProviderOptions };
    await options.onStepEnd?.({ callId, stepNumber: index, text: latest.text, toolCalls: latest.toolCalls ?? [], toolResults: stepResults, finishReason: lastFinishReason, usage: usage, state });
    await options.onStepFinish?.(state, latest);
    if ((conditions.length && (await Promise.all(conditions.map((condition) => condition(state, latest)))).some(Boolean)) || (!latest.toolCalls?.length && latest.finishReason !== "tool-calls")) {
      await options.onEnd?.({
        callId, text,
        toolCalls: allToolCalls, toolResults,
        finishReason: lastFinishReason, usage, steps,
        finalState: state,
      });
      return { ...state, text };
    }
  }
  const finalState: AgentLoopState = { step: maxSteps, steps, toolResults, usage, runtime: mutableRuntime, providerOptions: mutableProviderOptions };
  await options.onEnd?.({
    callId, text,
    toolCalls: allToolCalls, toolResults,
    finishReason: lastFinishReason ?? "unknown", usage, steps,
    finalState,
  });
  return { ...finalState, text };
}
