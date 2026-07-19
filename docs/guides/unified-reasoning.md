# Unified Reasoning

> Cross-provider reasoning control for AI generation. Configure how much "thinking" a model does before answering, with a portable API that works across OpenAI, Anthropic, Google, and more.

## Overview

FluxyChat provides a unified `reasoning` parameter that abstracts away provider-specific reasoning APIs. Instead of learning OpenAI's `reasoning_effort`, Anthropic's `thinking.budget_tokens`, or Google's `thinkingConfig`, you use one config object that maps to each provider automatically.

## Quick Start

```typescript
import { generate, stream } from "@fluxy-chat/agent";

// Generate with high reasoning effort
const result = await generate({
  model: myModel,
  prompt: "What is the square root of 144?",
  reasoning: { effort: "high", summary: "detailed" },
});

console.log(result.text);           // "12"
console.log(result.reasoningText);   // "To find the square root of 144, I need..."
console.log(result.usage.reasoningTokens);  // 832
```

## Configuration

The `AIReasoningConfig` interface:

```typescript
interface AIReasoningConfig {
  effort?: "low" | "medium" | "high";        // How hard the model thinks
  summary?: "auto" | "concise" | "detailed" | "none";  // Reasoning summary style
  budgetTokens?: number;                     // Max tokens for reasoning
}
```

### Effort Levels

| Level | OpenAI | Anthropic | Google |
|-------|--------|-----------|--------|
| `low` | `reasoning_effort: "low"` | `budget_tokens: 2000` | `thinkingBudget: 1024` |
| `medium` | `reasoning_effort: "medium"` | `budget_tokens: 8000` | `thinkingBudget: 8192` |
| `high` | `reasoning_effort: "high"` | `budget_tokens: 32000` | `thinkingBudget: 24576` |

### Boolean Shorthand

Pass `true` as a shorthand for `{ effort: "medium", summary: "auto" }`:

```typescript
await generate({
  model,
  prompt: "Explain quantum entanglement",
  reasoning: true,  // equivalent to { effort: "medium", summary: "auto" }
});
```

## Streaming with Reasoning

Reasoning parts are emitted as stream events before the text response:

```typescript
import { stream } from "@fluxy-chat/agent";

const result = stream({
  model: myModel,
  prompt: "Design a REST API for a todo app",
  reasoning: { effort: "high" },
});

for await (const part of result.stream) {
  switch (part.type) {
    case "reasoning-start":
      console.log("Model is thinking...");
      break;
    case "reasoning-delta":
      process.stdout.write(part.delta);
      break;
    case "reasoning-end":
      console.log("\n--- Reasoning complete ---");
      break;
    case "text-delta":
      process.stdout.write(part.delta);
      break;
    case "finish":
      console.log("\nUsage:", part.usage);
      break;
  }
}

const resolved = await result.result;
console.log("Reasoning:", resolved.reasoningText);
```

## Provider Mapping

Use `reasoningToProviderOptions` to convert the unified config to provider-specific options:

```typescript
import { reasoningToProviderOptions } from "@fluxy-chat/agent";

// For OpenAI
reasoningToProviderOptions({ effort: "high" }, "openai");
// → { reasoning_effort: "high" }

// For Anthropic
reasoningToProviderOptions({ effort: "high" }, "anthropic");
// → { thinking: { type: "enabled", budget_tokens: 32000 } }

// For Google
reasoningToProviderOptions({ effort: "low" }, "google");
// → { thinkingConfig: { thinkingBudget: 1024 } }
```

## Extracting Reasoning

```typescript
import { extractReasoningText } from "@fluxy-chat/agent";

const reasoning = extractReasoningText(streamParts);
// → "Let me think about this..."
```

## Usage Tracking

Reasoning tokens are included in the `AIUsage` object:

```typescript
const result = await generate({
  model,
  prompt: "Complex question",
  reasoning: { effort: "high" },
});

console.log(result.usage);
// {
//   inputTokens: 12,
//   outputTokens: 45,
//   reasoningTokens: 832,  // ← reasoning token count
//   totalTokens: 889
// }
```

## Testing with Reasoning

Use `DeterministicLanguageModel` with a reasoning response for tests:

```typescript
import { DeterministicLanguageModel } from "@fluxy-chat/agent";

const model = new DeterministicLanguageModel(
  "The answer is 42.",                                    // text response
  "I considered multiple approaches...",                  // reasoning response
  "test-model",
);

const result = await generate({
  model,
  prompt: "What is the answer?",
  reasoning: { effort: "high" },
});

expect(result.reasoningText).toBe("I considered multiple approaches...");
expect(result.usage.reasoningTokens).toBe(31);
```

## API Reference

| Export | Type | Description |
|--------|------|-------------|
| `AIReasoningConfig` | interface | Configuration object for reasoning |
| `AIReasoningEffort` | type | `"low" \| "medium" \| "high"` |
| `AIReasoningSummary` | type | `"auto" \| "concise" \| "detailed" \| "none"` |
| `AIReasoningResult` | interface | Extracted reasoning result |
| `normalizeReasoningConfig` | function | Normalizes config (handles `true` shorthand) |
| `isReasoningConfig` | function | Type guard for `AIReasoningConfig` |
| `reasoningToProviderOptions` | function | Maps config to provider-specific options |
| `reasoningToOpenAIOptions` | function | Maps to OpenAI format |
| `reasoningToAnthropicOptions` | function | Maps to Anthropic format |
| `reasoningToGoogleOptions` | function | Maps to Google format |
| `extractReasoningText` | function | Extracts reasoning text from stream parts |
| `mergeReasoningProviderMetadata` | function | Merges reasoning config into provider metadata |
