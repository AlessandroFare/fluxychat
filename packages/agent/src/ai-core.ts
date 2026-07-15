export type AIFinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "other"
  | "unknown";

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
}

export interface AIWarning {
  code?: string;
  message: string;
  details?: Record<string, unknown>;
}

export type AIProviderMetadata = Record<string, Record<string, unknown>>;

export type AIStreamPart<TData = unknown> =
  | { type: "start"; id?: string; modelId?: string }
  | { type: "start-step"; step: number }
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "reasoning-start"; id: string }
  | { type: "reasoning-delta"; id: string; delta: string }
  | { type: "reasoning-end"; id: string }
  | { type: "source"; sourceType: "url" | "document"; id: string; title?: string; url?: string; mediaType?: string }
  | { type: "file"; id: string; mediaType: string; url: string; filename?: string }
  | { type: "data"; id?: string; data: TData; transient?: boolean }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | { type: "tool-input-delta"; toolCallId: string; delta: string }
  | { type: "tool-input-available"; toolCallId: string; toolName: string; input: unknown }
  | { type: "tool-output-available"; toolCallId: string; output: unknown }
  | { type: "tool-error"; toolCallId: string; error: AIErrorData }
  | { type: "approval-request"; approvalId: string; toolCallId: string; toolName: string; input: unknown }
  | { type: "finish-step"; step: number; usage?: AIUsage; finishReason: AIFinishReason }
  | { type: "finish"; usage?: AIUsage; finishReason: AIFinishReason; providerMetadata?: AIProviderMetadata }
  | { type: "error"; error: AIErrorData };

export interface AIGenerationResult<TOutput = string> {
  output: TOutput;
  text: string;
  finishReason: AIFinishReason;
  usage: AIUsage;
  warnings: AIWarning[];
  providerMetadata?: AIProviderMetadata;
  steps?: readonly AIGenerationStep[];
}

export interface AIGenerationStep {
  step: number;
  text: string;
  finishReason: AIFinishReason;
  usage: AIUsage;
  providerMetadata?: AIProviderMetadata;
}

export type AIErrorCode =
  | "aborted"
  | "timeout"
  | "rate_limit"
  | "authentication"
  | "permission_denied"
  | "invalid_request"
  | "invalid_response"
  | "schema_validation"
  | "provider_error"
  | "stream_error"
  | "tool_error"
  | "unknown";

export interface AIErrorData {
  code: AIErrorCode;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

export class FluxyAIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly cause?: unknown;

  constructor(data: AIErrorData & { cause?: unknown }) {
    super(data.message);
    this.name = "FluxyAIError";
    this.code = data.code;
    this.retryable = data.retryable;
    this.statusCode = data.statusCode;
    this.cause = data.cause;
  }

  toJSON(): AIErrorData {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.statusCode === undefined ? {} : { statusCode: this.statusCode }),
    };
  }
}

export function normalizeFinishReason(reason: unknown): AIFinishReason {
  const value = typeof reason === "string" ? reason.toLowerCase().replace(/_/g, "-") : "";
  if (["stop", "end-turn", "end"].includes(value)) return "stop";
  if (["length", "max-tokens", "max-output-tokens"].includes(value)) return "length";
  if (["content-filter", "content-filtered", "safety"].includes(value)) return "content-filter";
  if (["tool-calls", "tool-call", "function-call"].includes(value)) return "tool-calls";
  if (["error", "failed"].includes(value)) return "error";
  if (!value) return "unknown";
  return "other";
}

export function normalizeUsage(usage: Partial<AIUsage> = {}): AIUsage {
  const safe = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
  const inputTokens = safe(usage.inputTokens);
  const outputTokens = safe(usage.outputTokens);
  const reasoningTokens = safe(usage.reasoningTokens);
  const cachedInputTokens = safe(usage.cachedInputTokens);
  const totalTokens = safe(usage.totalTokens) ??
    (inputTokens !== undefined || outputTokens !== undefined || reasoningTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0) + (reasoningTokens ?? 0)
      : undefined);
  return { inputTokens, outputTokens, reasoningTokens, cachedInputTokens, totalTokens };
}

export function addUsage(...items: Array<AIUsage | undefined>): AIUsage {
  const sum = (key: keyof AIUsage) => {
    const values = items
      .map((item) => item?.[key])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return values.length > 0 ? values.reduce((total, value) => total + value, 0) : undefined;
  };
  return normalizeUsage({
    inputTokens: sum("inputTokens"),
    outputTokens: sum("outputTokens"),
    reasoningTokens: sum("reasoningTokens"),
    cachedInputTokens: sum("cachedInputTokens"),
    totalTokens: sum("totalTokens"),
  });
}

export interface AIRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  onRetry?: (error: FluxyAIError, attempt: number, delayMs: number) => void | Promise<void>;
}

/** Retry only failures explicitly classified as retryable, with bounded exponential backoff and jitter. */
export async function retryAI<T>(operation: (attempt: number) => Promise<T>, options: AIRetryOptions = {}): Promise<T> {
  const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 2));
  const initialDelayMs = Math.max(0, options.initialDelayMs ?? 250);
  const maxDelayMs = Math.max(initialDelayMs, options.maxDelayMs ?? 4_000);

  for (let attempt = 0; ; attempt += 1) {
    if (options.signal?.aborted) {
      throw classifyAIError(options.signal.reason ?? new DOMException("Aborted", "AbortError"));
    }
    try {
      return await operation(attempt);
    } catch (error) {
      const classified = classifyAIError(error);
      if (!classified.retryable || attempt >= maxRetries) throw classified;
      const exponential = Math.min(maxDelayMs, initialDelayMs * 2 ** attempt);
      const delayMs = Math.round(exponential * (0.8 + Math.random() * 0.4));
      await options.onRetry?.(classified, attempt + 1, delayMs);
      await abortableDelay(delayMs, options.signal);
    }
  }
}

export function classifyAIError(error: unknown): FluxyAIError {
  if (error instanceof FluxyAIError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new FluxyAIError({ code: "aborted", message: "The AI operation was aborted.", retryable: false, cause: error });
  }
  const candidate = error as { message?: unknown; status?: unknown; statusCode?: unknown; name?: unknown } | null;
  const status = Number(candidate?.statusCode ?? candidate?.status);
  const message = typeof candidate?.message === "string" ? candidate.message : "The AI operation failed.";
  if (status === 401) return new FluxyAIError({ code: "authentication", message, retryable: false, statusCode: status, cause: error });
  if (status === 403) return new FluxyAIError({ code: "permission_denied", message, retryable: false, statusCode: status, cause: error });
  if (status === 429) return new FluxyAIError({ code: "rate_limit", message, retryable: true, statusCode: status, cause: error });
  if (status >= 500) return new FluxyAIError({ code: "provider_error", message, retryable: true, statusCode: status, cause: error });
  if (status >= 400) return new FluxyAIError({ code: "invalid_request", message, retryable: false, statusCode: status, cause: error });
  return new FluxyAIError({ code: "unknown", message, retryable: false, cause: error });
}

function abortableDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(classifyAIError(signal.reason ?? new DOMException("Aborted", "AbortError")));
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(classifyAIError(signal?.reason ?? new DOMException("Aborted", "AbortError")));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export function withTimeout(signal: AbortSignal | undefined, timeoutMs: number | undefined): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abortFromParent = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromParent();
  else signal?.addEventListener("abort", abortFromParent, { once: true });
  if (timeoutMs !== undefined && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(new FluxyAIError({
      code: "timeout",
      message: `The AI operation timed out after ${timeoutMs}ms.`,
      retryable: true,
    })), timeoutMs);
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", abortFromParent);
    },
  };
}
