import { describe, expect, it } from "vitest";
import {
  isReasoningConfig,
  normalizeReasoningConfig,
  reasoningToOpenAIOptions,
  reasoningToAnthropicOptions,
  reasoningToGoogleOptions,
  reasoningToProviderOptions,
  extractReasoningText,
  mergeReasoningProviderMetadata,
  type AIReasoningConfig,
} from "./reasoning";
import {
  DeterministicLanguageModel,
  AIProviderRegistry,
} from "./providers";
import { generate, stream } from "./generation";
import { collectStreamParts } from "./stream-utils";

describe("isReasoningConfig", () => {
  it("accepts valid config objects", () => {
    expect(isReasoningConfig({ effort: "high" })).toBe(true);
    expect(isReasoningConfig({ effort: "low", summary: "concise" })).toBe(true);
    expect(isReasoningConfig({ budgetTokens: 8000 })).toBe(true);
    expect(isReasoningConfig({ effort: "medium", summary: "detailed", budgetTokens: 4000 })).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isReasoningConfig(null)).toBe(false);
    expect(isReasoningConfig("high")).toBe(false);
    expect(isReasoningConfig({ effort: "invalid" })).toBe(false);
    expect(isReasoningConfig({ summary: "invalid" })).toBe(false);
    expect(isReasoningConfig({ budgetTokens: -1 })).toBe(false);
    expect(isReasoningConfig({ budgetTokens: "8000" })).toBe(false);
  });
});

describe("normalizeReasoningConfig", () => {
  it("returns undefined for falsy values", () => {
    expect(normalizeReasoningConfig(undefined)).toBeUndefined();
    expect(normalizeReasoningConfig(false)).toBeUndefined();
  });

  it("returns default for true", () => {
    const result = normalizeReasoningConfig(true);
    expect(result).toEqual({ effort: "medium", summary: "auto" });
  });

  it("preserves valid fields and drops undefined", () => {
    const result = normalizeReasoningConfig({ effort: "high", summary: undefined, budgetTokens: 5000 });
    expect(result).toEqual({ effort: "high", budgetTokens: 5000 });
  });

  it("returns undefined for empty config", () => {
    expect(normalizeReasoningConfig({})).toBeUndefined();
  });

  it("floors budgetTokens", () => {
    const result = normalizeReasoningConfig({ budgetTokens: 8000.9 });
    expect(result).toEqual({ budgetTokens: 8000 });
  });
});

describe("reasoningToOpenAIOptions", () => {
  it("maps effort to reasoning_effort", () => {
    expect(reasoningToOpenAIOptions({ effort: "high" })).toEqual({ reasoning_effort: "high" });
  });

  it("maps summary to reasoning.summary", () => {
    expect(reasoningToOpenAIOptions({ summary: "concise" })).toEqual({ reasoning: { summary: "concise" } });
  });

  it("maps budgetTokens to max_completion_tokens", () => {
    expect(reasoningToOpenAIOptions({ budgetTokens: 16000 })).toEqual({ max_completion_tokens: 16000 });
  });

  it("maps all fields together", () => {
    const opts = reasoningToOpenAIOptions({ effort: "low", summary: "detailed", budgetTokens: 4000 });
    expect(opts).toEqual({
      reasoning_effort: "low",
      reasoning: { summary: "detailed" },
      max_completion_tokens: 4000,
    });
  });
});

describe("reasoningToAnthropicOptions", () => {
  it("maps effort to thinking with budget", () => {
    const opts = reasoningToAnthropicOptions({ effort: "high" });
    expect(opts).toEqual({ thinking: { type: "enabled", budget_tokens: 32000 } });
  });

  it("uses custom budgetTokens when provided", () => {
    const opts = reasoningToAnthropicOptions({ effort: "low", budgetTokens: 5000 });
    expect(opts).toEqual({ thinking: { type: "enabled", budget_tokens: 5000 } });
  });

  it("returns empty for config without effort", () => {
    expect(reasoningToAnthropicOptions({ summary: "concise" })).toEqual({});
  });
});

describe("reasoningToGoogleOptions", () => {
  it("maps effort to thinkingConfig with budget", () => {
    const opts = reasoningToGoogleOptions({ effort: "medium" });
    expect(opts).toEqual({ thinkingConfig: { thinkingBudget: 8192 } });
  });

  it("uses custom budgetTokens", () => {
    const opts = reasoningToGoogleOptions({ effort: "low", budgetTokens: 2048 });
    expect(opts).toEqual({ thinkingConfig: { thinkingBudget: 2048 } });
  });
});

describe("reasoningToProviderOptions", () => {
  it("routes OpenAI-compatible providers to OpenAI mapping", () => {
    expect(reasoningToProviderOptions({ effort: "high" }, "openai")).toEqual({ reasoning_effort: "high" });
    expect(reasoningToProviderOptions({ effort: "high" }, "Azure")).toEqual({ reasoning_effort: "high" });
    expect(reasoningToProviderOptions({ effort: "high" }, "groq")).toEqual({ reasoning_effort: "high" });
  });

  it("routes Anthropic to Anthropic mapping", () => {
    const opts = reasoningToProviderOptions({ effort: "medium" }, "anthropic");
    expect(opts).toEqual({ thinking: { type: "enabled", budget_tokens: 8000 } });
  });

  it("routes Google to Google mapping", () => {
    const opts = reasoningToProviderOptions({ effort: "low" }, "google");
    expect(opts).toEqual({ thinkingConfig: { thinkingBudget: 1024 } });
  });

  it("returns empty for unknown provider", () => {
    expect(reasoningToProviderOptions({ effort: "high" }, "unknown")).toEqual({});
  });
});

describe("extractReasoningText", () => {
  it("extracts text from reasoning-delta parts", () => {
    const parts = [
      { type: "reasoning-start", id: "r1" },
      { type: "reasoning-delta", id: "r1", delta: "Hello " },
      { type: "reasoning-delta", id: "r1", delta: "world" },
      { type: "reasoning-end", id: "r1" },
      { type: "text-delta", id: "t1", delta: "Answer" },
    ];
    expect(extractReasoningText(parts)).toBe("Hello world");
  });

  it("returns empty string for no reasoning parts", () => {
    const parts = [{ type: "text-delta", id: "t1", delta: "Answer" }];
    expect(extractReasoningText(parts)).toBe("");
  });
});

describe("mergeReasoningProviderMetadata", () => {
  it("adds reasoning to existing metadata", () => {
    const base = { openai: { model: "gpt-4" } };
    const result = mergeReasoningProviderMetadata(base, { effort: "high" });
    expect(result).toEqual({
      openai: { model: "gpt-4" },
      fluxy: { reasoning: { effort: "high" } },
    });
  });

  it("returns base when reasoning is undefined", () => {
    const base = { openai: { model: "gpt-4" } };
    expect(mergeReasoningProviderMetadata(base, undefined)).toBe(base);
  });
});

describe("generate with reasoning", () => {
  it("passes reasoning config to model and extracts reasoningText", async () => {
    const model = new DeterministicLanguageModel(
      (req) => `Answer: ${req.prompt.length} messages`,
      (req) => `Thinking about ${req.prompt.length} messages with effort ${req.reasoning?.effort ?? "none"}`,
    );

    const result = await generate({
      model,
      prompt: "What is 2+2?",
      reasoning: { effort: "high", summary: "detailed" },
    });

    expect(result.text).toContain("Answer");
    expect(result.reasoningText).toContain("Thinking about");
    expect(result.reasoningText).toContain("effort high");
    expect(result.usage.reasoningTokens).toBeGreaterThan(0);
  });

  it("works without reasoning config", async () => {
    const model = new DeterministicLanguageModel("Simple answer");
    const result = await generate({ model, prompt: "Hello" });
    expect(result.text).toBe("Simple answer");
    expect(result.reasoningText).toBeUndefined();
  });

  it("normalizes boolean true to medium effort", async () => {
    let capturedEffort: string | undefined;
    const model = new DeterministicLanguageModel(
      () => "answer",
      (req) => `effort: ${req.reasoning?.effort}`,
    );
    const result = await generate({
      model,
      prompt: "test",
      reasoning: true as unknown as AIReasoningConfig,
    });
    expect(result.reasoningText).toBe("effort: medium");
  });
});

describe("stream with reasoning", () => {
  it("emits reasoning stream parts and includes reasoningText in result", async () => {
    const model = new DeterministicLanguageModel(
      "The answer is 42.",
      "Let me think about this deeply.",
    );

    const result = stream({
      model,
      prompt: "What is the meaning of life?",
      reasoning: { effort: "high" },
    });

    const { text, reasoningText, parts } = await collectStreamParts(result.stream);
    const resolved = await result.result;

    expect(parts.some((p) => p.type === "reasoning-start")).toBe(true);
    expect(parts.some((p) => p.type === "reasoning-delta")).toBe(true);
    expect(parts.some((p) => p.type === "reasoning-end")).toBe(true);
    expect(reasoningText).toBe("Let me think about this deeply.");
    expect(text).toBe("The answer is 42.");
    expect(resolved.reasoningText).toBe("Let me think about this deeply.");
  });

  it("works without reasoning in stream", async () => {
    const model = new DeterministicLanguageModel("No reasoning here.");
    const result = stream({ model, prompt: "test" });
    const { reasoningText, parts } = await collectStreamParts(result.stream);
    expect(reasoningText).toBe("");
    expect(parts.some((p) => p.type === "reasoning-start")).toBe(false);
  });
});

describe("DeterministicLanguageModel with reasoning", () => {
  it("reports reasoning capability", () => {
    const model = new DeterministicLanguageModel("test");
    expect(model.capabilities.reasoning).toBe(true);
  });

  it("includes reasoningTokens in usage when reasoning is present", async () => {
    const model = new DeterministicLanguageModel("answer", "thinking process");
    const response = await model.generate({
      prompt: [{ role: "user", content: "test" }],
    });
    expect(response.reasoningText).toBe("thinking process");
    expect(response.usage?.reasoningTokens).toBe(16);
  });

  it("omits reasoningText when no reasoning response is configured", async () => {
    const model = new DeterministicLanguageModel("just text");
    const response = await model.generate({
      prompt: [{ role: "user", content: "test" }],
    });
    expect(response.reasoningText).toBeUndefined();
    expect(response.usage?.reasoningTokens).toBeUndefined();
  });
});

describe("registry with reasoning models", () => {
  it("can register and resolve a reasoning-capable model", () => {
    const registry = new AIProviderRegistry();
    const model = new DeterministicLanguageModel("test", "reasoning", "reasoning-model");
    registry.register(model);
    const resolved = registry.resolve<InstanceType<typeof DeterministicLanguageModel>>("fluxy-test:reasoning-model");
    expect(resolved.capabilities.reasoning).toBe(true);
  });
});
