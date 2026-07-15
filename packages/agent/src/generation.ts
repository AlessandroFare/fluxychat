import {
  FluxyAIError,
  addUsage,
  classifyAIError,
  normalizeUsage,
  retryAI,
  withTimeout,
  type AIGenerationResult,
  type AIStreamPart,
  type AIUsage,
  type AIWarning,
  type AIRetryOptions,
} from "./ai-core";
import type { AILanguageModel, AIMessage, AIModelRequest } from "./providers";

export type AIPrompt = string | readonly AIMessage[];

export interface AIGenerateOptions extends Omit<AIModelRequest, "prompt" | "signal"> {
  model: AILanguageModel;
  prompt: AIPrompt;
  system?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  retry?: Omit<AIRetryOptions, "signal">;
  onStart?: () => void | Promise<void>;
  onFinish?: (result: AIGenerationResult) => void | Promise<void>;
  onError?: (error: FluxyAIError) => void | Promise<void>;
}

export interface AIStreamResult {
  readonly stream: ReadableStream<AIStreamPart>;
  readonly result: Promise<AIGenerationResult>;
  readonly text: Promise<string>;
  abort(reason?: unknown): void;
}

export function canonicalPrompt(prompt: AIPrompt, system?: string): AIMessage[] {
  const messages = typeof prompt === "string" ? [{ role: "user" as const, content: prompt }] : [...prompt];
  return system ? [{ role: "system", content: system }, ...messages] : messages;
}

function modelRequest(options: AIGenerateOptions, signal: AbortSignal): AIModelRequest {
  const { model: _model, prompt, system, timeoutMs: _timeout, retry: _retry, onStart: _start, onFinish: _finish, onError: _error, signal: _signal, ...settings } = options;
  return { ...settings, prompt: canonicalPrompt(prompt, system), signal };
}

export async function generate(options: AIGenerateOptions): Promise<AIGenerationResult> {
  const timed = withTimeout(options.signal, options.timeoutMs);
  try {
    await options.onStart?.();
    const response = await retryAI(
      () => options.model.generate(modelRequest(options, timed.signal)),
      { ...options.retry, signal: timed.signal },
    );
    const result: AIGenerationResult = {
      output: response.text,
      text: response.text,
      finishReason: response.finishReason,
      usage: normalizeUsage(response.usage),
      warnings: [...(response.warnings ?? [])],
      providerMetadata: response.providerMetadata,
    };
    await options.onFinish?.(result);
    return result;
  } catch (error) {
    const classified = classifyAIError(error);
    await options.onError?.(classified);
    throw classified;
  } finally {
    timed.cleanup();
  }
}

export function stream(options: AIGenerateOptions): AIStreamResult {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromParent();
  else options.signal?.addEventListener("abort", abortFromParent, { once: true });
  const timed = withTimeout(controller.signal, options.timeoutMs);

  let resolveResult!: (result: AIGenerationResult) => void;
  let rejectResult!: (reason: unknown) => void;
  const result = new Promise<AIGenerationResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  void result.catch(() => undefined);

  const output = new ReadableStream<AIStreamPart>({
    async start(target) {
      let text = "";
      let usage: AIUsage = {};
      let finishReason: AIGenerationResult["finishReason"] = "unknown";
      let warnings: AIWarning[] = [];
      try {
        await options.onStart?.();
        if (!options.model.stream) {
          const generated = await generate({ ...options, signal: timed.signal, timeoutMs: undefined, onStart: undefined, onFinish: undefined, onError: undefined });
          target.enqueue({ type: "start", modelId: `${options.model.provider}:${options.model.modelId}` });
          target.enqueue({ type: "text-start", id: "text-0" });
          if (generated.text) target.enqueue({ type: "text-delta", id: "text-0", delta: generated.text });
          target.enqueue({ type: "text-end", id: "text-0" });
          target.enqueue({ type: "finish", finishReason: generated.finishReason, usage: generated.usage });
          text = generated.text;
          usage = generated.usage;
          finishReason = generated.finishReason;
          warnings = generated.warnings;
        } else {
          const source = await retryAI(
            () => options.model.stream!(modelRequest(options, timed.signal)),
            { ...options.retry, signal: timed.signal },
          );
          const reader = source.getReader();
          try {
            for (;;) {
              const next = await reader.read();
              if (next.done) break;
              const part = next.value;
              if (part.type === "text-delta") text += part.delta;
              if (part.type === "finish-step" || part.type === "finish") {
                usage = addUsage(usage, part.usage);
                finishReason = part.finishReason;
              }
              target.enqueue(part);
            }
          } finally {
            reader.releaseLock();
          }
        }
        const completed: AIGenerationResult = { output: text, text, usage: normalizeUsage(usage), finishReason, warnings };
        await options.onFinish?.(completed);
        resolveResult(completed);
        target.close();
      } catch (error) {
        const classified = classifyAIError(error);
        await options.onError?.(classified);
        rejectResult(classified);
        target.error(classified);
      } finally {
        timed.cleanup();
        options.signal?.removeEventListener("abort", abortFromParent);
      }
    },
    cancel(reason) { controller.abort(reason); },
  });

  return {
    stream: output,
    result,
    text: result.then((value) => value.text),
    abort: (reason) => controller.abort(reason),
  };
}
