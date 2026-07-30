import type { AIProviderMetadata } from "./ai-core";

export type AIReasoningEffort = "low" | "medium" | "high";
export type AIReasoningSummary = "auto" | "concise" | "detailed" | "none";

export interface AIReasoningConfig {
  effort?: AIReasoningEffort;
  summary?: AIReasoningSummary;
  budgetTokens?: number;
}

export interface AIReasoningResult {
  text: string;
  effort?: AIReasoningEffort;
  summary?: AIReasoningSummary;
  budgetTokens?: number;
}

export function isReasoningConfig(value: unknown): value is AIReasoningConfig {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if ("effort" in v && v.effort !== undefined && !["low", "medium", "high"].includes(v.effort as string)) return false;
  if ("summary" in v && v.summary !== undefined && !["auto", "concise", "detailed", "none"].includes(v.summary as string)) return false;
  if ("budgetTokens" in v && v.budgetTokens !== undefined && (typeof v.budgetTokens !== "number" || v.budgetTokens < 0)) return false;
  return true;
}

export function normalizeReasoningConfig(config: AIReasoningConfig | boolean | undefined): AIReasoningConfig | undefined {
  if (config === undefined || config === false) return undefined;
  if (config === true) return { effort: "medium", summary: "auto" };
  const result: AIReasoningConfig = {};
  if (config.effort) result.effort = config.effort;
  if (config.summary) result.summary = config.summary;
  if (typeof config.budgetTokens === "number" && config.budgetTokens > 0) result.budgetTokens = Math.floor(config.budgetTokens);
  return Object.keys(result).length > 0 ? result : undefined;
}

export function reasoningToOpenAIOptions(config: AIReasoningConfig): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  if (config.effort) opts.reasoning_effort = config.effort;
  if (config.summary) opts.reasoning = { summary: config.summary };
  if (config.budgetTokens) opts.max_completion_tokens = config.budgetTokens;
  return opts;
}

export function reasoningToAnthropicOptions(config: AIReasoningConfig): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  if (config.effort) {
    const budgetMap: Record<AIReasoningEffort, number> = { low: 2_000, medium: 8_000, high: 32_000 };
    opts.thinking = { type: "enabled", budget_tokens: config.budgetTokens ?? budgetMap[config.effort] };
  }
  return opts;
}

export function reasoningToGoogleOptions(config: AIReasoningConfig): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  if (config.effort) {
    const budgetMap: Record<AIReasoningEffort, number> = { low: 1_024, medium: 8_192, high: 24_576 };
    opts.thinkingConfig = { thinkingBudget: config.budgetTokens ?? budgetMap[config.effort] };
  }
  return opts;
}

export function reasoningToProviderOptions(
  config: AIReasoningConfig,
  provider: string,
): Record<string, unknown> {
  switch (provider.toLowerCase()) {
    case "openai":
    case "azure":
    case "deepinfra":
    case "together":
    case "fireworks":
    case "groq":
    case "cerebras":
      return reasoningToOpenAIOptions(config);
    case "anthropic":
      return reasoningToAnthropicOptions(config);
    case "google":
    case "google-generative-ai":
    case "google-vertex":
      return reasoningToGoogleOptions(config);
    default:
      return {};
  }
}

export function extractReasoningText(parts: readonly { type: string; delta?: string; text?: string }[]): string {
  let text = "";
  for (const part of parts) {
    if (part.type === "reasoning-delta" && part.delta) text += part.delta;
  }
  return text;
}

export function mergeReasoningProviderMetadata(
  base: AIProviderMetadata | undefined,
  reasoning: AIReasoningConfig | undefined,
): AIProviderMetadata | undefined {
  if (!reasoning) return base;
  return {
    ...(base ?? {}),
    fluxy: {
      ...(base?.fluxy ?? {}),
      reasoning,
    },
  };
}
