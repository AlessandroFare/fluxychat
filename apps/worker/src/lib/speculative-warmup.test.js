import { describe, it, expect } from "vitest";
import {
  buildWarmupCacheEntry,
  consumeWarmupCacheEntry,
  countWords,
  formatWarmupContextForAgent,
  isSpeculativeWarmupEnabled,
  textMatchesWarmup,
} from "./speculative-warmup.js";

describe("speculative-warmup", () => {
  it("detects env flag", () => {
    expect(isSpeculativeWarmupEnabled({ SPECULATIVE_WARMUP_ENABLED: "true" })).toBe(true);
    expect(isSpeculativeWarmupEnabled({ SPECULATIVE_WARMUP_ENABLED: "0" })).toBe(false);
  });

  it("requires minimum words before warmup", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("find the latest invoice")).toBe(4);
  });

  it("matches submitted text that extends partial draft", () => {
    expect(textMatchesWarmup("find the latest", "find the latest invoice please")).toBe(true);
    expect(textMatchesWarmup("completely different topic", "find the latest invoice")).toBe(false);
  });

  it("consumes cache as hit or miss", () => {
    const entry = buildWarmupCacheEntry("find the latest invoice", [
      { id: 1, content: "Invoice #42", createdAt: "2026-01-01T00:00:00.000Z" },
    ], 1_000);
    const hit = consumeWarmupCacheEntry(entry, "find the latest invoice details", 2_000);
    expect(hit.hit).toBe(true);
    expect(hit.results).toHaveLength(1);

    const miss = consumeWarmupCacheEntry(entry, "what is the weather", 2_000);
    expect(miss.hit).toBe(false);
    expect(miss.outcome).toBe("miss");
  });

  it("formats warmed context for agent system prompt", () => {
    const formatted = formatWarmupContextForAgent([
      { id: 9, content: "Deploy checklist", createdAt: "2026-01-02T12:00:00.000Z" },
    ]);
    expect(formatted).toContain("Speculative retrieval cache hit");
    expect(formatted).toContain("Deploy checklist");
  });
});
