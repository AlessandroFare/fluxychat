/**
 * P23-4: Language Model Middleware
 * Pluggable layer to intercept/modify LLM calls.
 * Supports guardrails, caching, RAG injection, logging, parameter transformation.
 */

export interface LLMCallParams {
  model: string;
  provider: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  [key: string]: unknown;
}

export interface LLMCallResult {
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: string;
  latencyMs?: number;
  [key: string]: unknown;
}

export type TransformParamsFn = (params: LLMCallParams) => LLMCallParams | Promise<LLMCallParams>;
export type WrapGenerateFn = (params: LLMCallParams, next: () => Promise<LLMCallResult>) => Promise<LLMCallResult>;
export type WrapStreamFn = (params: LLMCallParams, next: () => AsyncGenerator<LLMStreamChunk>) => AsyncGenerator<LLMStreamChunk>;

export interface LLMStreamChunk {
  type: "text" | "tool_call" | "tool_call_start" | "tool_call_delta" | "error" | "finish";
  text?: string;
  toolCallId?: string;
  toolName?: string;
  delta?: string;
  error?: string;
  finishReason?: string;
}

export interface LLMMiddleware {
  name: string;
  transformParams?: TransformParamsFn;
  wrapGenerate?: WrapGenerateFn;
  wrapStream?: WrapStreamFn;
}

export function createLLMMiddleware(opts: {
  name: string;
  transformParams?: TransformParamsFn;
  wrapGenerate?: WrapGenerateFn;
  wrapStream?: WrapStreamFn;
}): LLMMiddleware {
  throw new Error("createLLMMiddleware not implemented in SDK - use worker runtime");
}

export function wrapLanguageModel(
  model: { generate: (params: LLMCallParams) => Promise<LLMCallResult>; stream: (params: LLMCallParams) => AsyncGenerator<LLMStreamChunk> },
  middlewares: LLMMiddleware[],
): { generate: (params: LLMCallParams) => Promise<LLMCallResult>; stream: (params: LLMCallParams) => AsyncGenerator<LLMStreamChunk> } {
  throw new Error("wrapLanguageModel not implemented in SDK - use worker runtime");
}

export function composeMiddlewares(...middlewares: LLMMiddleware[]): LLMMiddleware {
  throw new Error("composeMiddlewares not implemented in SDK - use worker runtime");
}
