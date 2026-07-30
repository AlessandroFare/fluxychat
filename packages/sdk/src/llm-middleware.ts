/**
 * P23-4: Language Model Middleware — SDK implementation (mirrors worker runtime).
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
export type WrapStreamFn = (
  params: LLMCallParams,
  next: () => AsyncGenerator<LLMStreamChunk>,
) => AsyncGenerator<LLMStreamChunk>;

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
  return {
    name: opts.name,
    transformParams: opts.transformParams,
    wrapGenerate: opts.wrapGenerate,
    wrapStream: opts.wrapStream,
  };
}

export function composeMiddlewares(...middlewares: LLMMiddleware[]): LLMMiddleware {
  return {
    name: `composed(${middlewares.map((m) => m.name).join(", ")})`,

    async transformParams(params) {
      let result = params;
      for (const mw of middlewares) {
        if (mw.transformParams) {
          result = await mw.transformParams(result);
        }
      }
      return result;
    },

    async wrapGenerate(params, next) {
      let chain = next;
      for (let i = middlewares.length - 1; i >= 0; i--) {
        const mw = middlewares[i];
        if (mw.wrapGenerate) {
          const prev = chain;
          chain = () => mw.wrapGenerate!(params, prev);
        }
      }
      return chain();
    },

    async *wrapStream(params, next) {
      let chain = next;
      for (let i = middlewares.length - 1; i >= 0; i--) {
        const mw = middlewares[i];
        if (mw.wrapStream) {
          const prev = chain;
          chain = () => mw.wrapStream!(params, prev);
        }
      }
      yield* chain();
    },
  };
}

export interface WrappedLanguageModel {
  generate(params: LLMCallParams): Promise<LLMCallResult>;
  stream(params: LLMCallParams): AsyncGenerator<LLMStreamChunk>;
}

export function wrapLanguageModel(
  model: WrappedLanguageModel,
  middlewares: LLMMiddleware[],
): WrappedLanguageModel {
  if (!middlewares.length) return model;
  const composed = composeMiddlewares(...middlewares);

  return {
    async generate(params) {
      let finalParams = params;
      if (composed.transformParams) {
        finalParams = await composed.transformParams(params);
      }
      if (composed.wrapGenerate) {
        return composed.wrapGenerate(finalParams, () => model.generate(finalParams));
      }
      return model.generate(finalParams);
    },

    async *stream(params) {
      let finalParams = params;
      if (composed.transformParams) {
        finalParams = await composed.transformParams(params);
      }
      if (composed.wrapStream) {
        yield* composed.wrapStream(finalParams, () => model.stream(finalParams));
      } else {
        yield* model.stream(finalParams);
      }
    },
  };
}

export function createLoggingMiddleware(
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void },
): LLMMiddleware {
  return createLLMMiddleware({
    name: "logging",
    async wrapGenerate(params, next) {
      const start = Date.now();
      const result = await next();
      logger.info("llm.generate", {
        model: params.model,
        provider: params.provider,
        latencyMs: Date.now() - start,
      });
      return result;
    },
  });
}
