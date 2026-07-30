import { describe, expect, it, vi } from "vitest";
import {
  addUsage,
  classifyAIError,
  normalizeFinishReason,
  normalizeUsage,
  retryAI,
  withTimeout,
} from "./ai-core";

describe("AI core contracts", () => {
  it("normalizes provider finish reasons", () => {
    expect(normalizeFinishReason("end_turn")).toBe("stop");
    expect(normalizeFinishReason("max_tokens")).toBe("length");
    expect(normalizeFinishReason("safety")).toBe("content-filter");
    expect(normalizeFinishReason("function_call")).toBe("tool-calls");
    expect(normalizeFinishReason(undefined)).toBe("unknown");
    expect(normalizeFinishReason("provider-specific")).toBe("other");
  });

  it("normalizes usage and computes a safe total", () => {
    expect(normalizeUsage({ inputTokens: 4.9, outputTokens: 3, reasoningTokens: 2 })).toEqual({
      inputTokens: 4,
      outputTokens: 3,
      reasoningTokens: 2,
      cachedInputTokens: undefined,
      totalTokens: 9,
    });
    expect(normalizeUsage({ inputTokens: -1, totalTokens: Number.NaN }).totalTokens).toBeUndefined();
  });

  it("adds usage across multi-step generations", () => {
    expect(addUsage(
      { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
      { inputTokens: 3, reasoningTokens: 1, totalTokens: 4 },
    )).toEqual({
      inputTokens: 7,
      outputTokens: 2,
      reasoningTokens: 1,
      cachedInputTokens: undefined,
      totalTokens: 10,
    });
  });

  it("retries only retryable failures", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ status: 429, message: "slow down" })
      .mockResolvedValue("ok");
    await expect(retryAI(operation, { maxRetries: 1, initialDelayMs: 0 })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);

    const invalid = vi.fn().mockRejectedValue({ status: 400, message: "bad request" });
    await expect(retryAI(invalid, { maxRetries: 3, initialDelayMs: 0 })).rejects.toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
    expect(invalid).toHaveBeenCalledTimes(1);
  });

  it("classifies retryable provider failures", () => {
    expect(classifyAIError({ status: 429, message: "slow down" }).toJSON()).toEqual({
      code: "rate_limit",
      message: "slow down",
      retryable: true,
      statusCode: 429,
    });
    expect(classifyAIError({ statusCode: 400, message: "bad" }).retryable).toBe(false);
  });

  it("combines parent abort with timeout and cleans up", () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const timeout = withTimeout(parent.signal, 50);
    expect(timeout.signal.aborted).toBe(false);
    vi.advanceTimersByTime(50);
    expect(timeout.signal.aborted).toBe(true);
    timeout.cleanup();
    vi.useRealTimers();
  });
});
