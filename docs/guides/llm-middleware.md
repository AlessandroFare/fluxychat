# LLM Middleware Pipeline

FluxyChat's language model middleware (P23-4) is a pluggable layer that intercepts, modifies, or augments LLM calls — enabling guardrails, caching, RAG injection, logging, and parameter transformation.

## Overview

Middleware sits between the agent runtime and the LLM provider. Each middleware can:

- **Transform parameters** before the model call (system prompt injection, token budgeting)
- **Wrap generation** (logging, metrics, retry, fallback)
- **Wrap streaming** (real-time content filtering, token counting)
- **Short-circuit** (return cached response, block request)

## Built-in Middleware

### `extractReasoningMiddleware` (P24-7)

Surfaces chain-of-thought reasoning from models that output thinking tokens (e.g., Claude's extended thinking, o1's reasoning steps).

```ts
import { extractReasoningMiddleware } from "@fluxy-chat/sdk";

const middleware = extractReasoningMiddleware();
// Reasoning tokens are extracted and exposed as `reasoning` in the response
```

### RAG Middleware (P24-8)

Injects relevant context from a knowledge base into the LLM prompt:

```ts
import { createRagMiddleware } from "@fluxy-chat/sdk";

const rag = createRagMiddleware({
  retrieve: async (query) => {
    // Search your knowledge base
    return { context: "Relevant docs...", sources: ["doc1", "doc2"] };
  },
});
```

### Custom Middleware

```ts
import { wrapLanguageModel, transformParams } from "@fluxy-chat/sdk";

const loggingMiddleware = wrapLanguageModel({
  transformParams: async ({ params }) => {
    console.log("LLM call:", params.model, params.messages.length, "messages");
    return params;
  },
  wrapGenerate: async ({ doGenerate, params }) => {
    const start = Date.now();
    const result = await doGenerate(params);
    console.log("Generate:", Date.now() - start, "ms");
    return result;
  },
  wrapStream: async ({ doStream, params }) => {
    return doStream(params); // pass through, or intercept chunks
  },
});
```

## Composition

Middleware composes in order — each wraps the next:

```ts
import { composeMiddleware } from "@fluxy-chat/sdk";

const pipeline = composeMiddleware([
  extractReasoningMiddleware(),
  ragMiddleware,
  loggingMiddleware,
  guardrailsMiddleware,
]);

// Apply to agent runtime
const agent = createAgent({
  model: "gpt-4o",
  middleware: pipeline,
});
```

## Common Patterns

### System Prompt Injection

```ts
const systemPromptMiddleware = transformParams(async ({ params }) => {
  return {
    ...params,
    messages: [
      { role: "system", content: "You are a support agent for ACME Corp." },
      ...params.messages,
    ],
  };
});
```

### Response Caching

```ts
const cacheMiddleware = wrapLanguageModel({
  wrapGenerate: async ({ doGenerate, params }) => {
    const cacheKey = JSON.stringify(params);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const result = await doGenerate(params);
    await cache.set(cacheKey, result, { ttl: 3600 });
    return result;
  },
});
```

### Token Budgeting

```ts
const budgetMiddleware = transformParams(async ({ params }) => {
  const totalTokens = estimateTokens(params.messages);
  if (totalTokens > 100_000) {
    // Truncate older messages
    params.messages = truncateHistory(params.messages, 100_000);
  }
  return params;
});
```

### PII Redaction (P18-D)

The DLP pipeline uses middleware to redact PII before sending to LLM providers:

```ts
const dlpMiddleware = transformParams(async ({ params }) => {
  params.messages = params.messages.map(m => ({
    ...m,
    content: redactPII(m.content), // replaces SSNs, credit cards, etc.
  }));
  return params;
});
```

## Provider-Level Middleware (P24-9)

Apply middleware to all models from a provider at once:

```ts
import { wrapProvider } from "@fluxy-chat/sdk";

const enhancedOpenAI = wrapProvider(openai, [
  loggingMiddleware,
  guardrailsMiddleware,
]);

// All models from this provider get middleware
const model = enhancedOpenAI("gpt-4o");
```

## See Also

- [AI Tool Presets Guide](./ai-tool-presets.md) — Tool-level governance
- [MCP Client Guide](./mcp-client.md) — External tool integration
