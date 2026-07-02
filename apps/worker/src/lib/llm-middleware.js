/**
 * P23-4: Language Model Middleware — Worker Implementation
 * Pluggable layer to intercept/modify LLM calls.
 */

/**
 * Create a middleware instance.
 * @param {Object} opts
 * @param {string} opts.name - Middleware name
 * @param {Function} [opts.transformParams] - Modify params before LLM call
 * @param {Function} [opts.wrapGenerate] - Wrap generate operation
 * @param {Function} [opts.wrapStream] - Wrap stream operation
 */
export function createLLMMiddleware({ name, transformParams, wrapGenerate, wrapStream }) {
  return { name, transformParams, wrapGenerate, wrapStream };
}

/**
 * Compose multiple middlewares into a single middleware.
 * Execution order: first middleware in = outermost wrapper.
 */
export function composeMiddlewares(...middlewares) {
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
      // Build nested chain: last middleware is innermost
      let chain = next;
      for (let i = middlewares.length - 1; i >= 0; i--) {
        const mw = middlewares[i];
        if (mw.wrapGenerate) {
          const prevChain = chain;
          chain = () => mw.wrapGenerate(params, prevChain);
        }
      }
      return chain();
    },

    async *wrapStream(params, next) {
      // Build nested chain: last middleware is innermost
      let chain = next;
      for (let i = middlewares.length - 1; i >= 0; i--) {
        const mw = middlewares[i];
        if (mw.wrapStream) {
          const prevChain = chain;
          chain = () => mw.wrapStream(params, prevChain);
        }
      }
      yield* chain();
    },
  };
}

/**
 * Wrap a language model with middlewares.
 * @param {Object} model - Model with generate() and stream() methods
 * @param {Array} middlewares - Array of middleware instances
 * @returns {Object} Wrapped model
 */
export function wrapLanguageModel(model, middlewares) {
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

// =============================================================================
// Built-in Middlewares
// =============================================================================

/**
 * Logging middleware — logs all LLM calls with timing.
 */
export function createLoggingMiddleware(logger) {
  return createLLMMiddleware({
    name: "logging",
    async wrapGenerate(params, next) {
      const start = performance.now();
      const result = await next();
      const latencyMs = Math.round(performance.now() - start);
      logger.info("llm.generate", {
        model: params.model,
        provider: params.provider,
        latencyMs,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      });
      return result;
    },
    async *wrapStream(params, next) {
      const start = performance.now();
      let chunks = 0;
      for await (const chunk of next()) {
        chunks++;
        yield chunk;
      }
      const latencyMs = Math.round(performance.now() - start);
      logger.info("llm.stream", {
        model: params.model,
        provider: params.provider,
        latencyMs,
        chunks,
      });
    },
  });
}

/**
 * Transform params middleware — inject system prompt prefix.
 */
export function createSystemPromptMiddleware(prefix) {
  return createLLMMiddleware({
    name: "system-prompt",
    transformParams(params) {
      const messages = [...(params.messages || [])];
      if (messages.length > 0 && messages[0].role === "system") {
        messages[0] = { ...messages[0], content: `${prefix}\n\n${messages[0].content}` };
      } else {
        messages.unshift({ role: "system", content: prefix });
      }
      return { ...params, messages };
    },
  });
}

/**
 * Token budget middleware — enforce max token limits.
 */
export function createTokenBudgetMiddleware(maxTokens) {
  return createLLMMiddleware({
    name: "token-budget",
    transformParams(params) {
      return { ...params, maxTokens: Math.min(params.maxTokens || maxTokens, maxTokens) };
    },
  });
}

/**
 * Retry middleware — retry on failure with exponential backoff.
 */
export function createRetryMiddleware(maxRetries = 3, baseDelayMs = 1000) {
  return createLLMMiddleware({
    name: "retry",
    async wrapGenerate(params, next) {
      let lastError;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await next();
        } catch (err) {
          lastError = err;
          if (attempt < maxRetries) {
            const delay = baseDelayMs * 2 ** attempt;
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
      throw lastError;
    },
  });
}
