import { describe, expect, it } from "vitest";
import {
  createMemorySummaryStore,
  createMemorySearchIndex,
  createModerationEngine,
  createMemoryTranslationCache,
} from "./ai-moderation";

describe("summary store", () => {
  it("saves and retrieves summaries", async () => {
    const store = createMemorySummaryStore();
    await store.save({
      summaryId: "s1", roomId: "r1", periodStart: "2026-01-01", periodEnd: "2026-01-02",
      title: "Discussion", keyPoints: ["point 1"], participantSummary: "Alice, Bob",
      actionItems: [], messageCount: 10, generatedBy: "agent-1",
      provenance: { inputMessageIds: ["m1", "m2"], generatedAt: "2026-01-02T00:00:00Z" },
    });
    const got = await store.get("s1");
    expect(got).not.toBeNull();
    expect(got!.title).toBe("Discussion");
    expect(got!.provenance).not.toBeNull();
  });

  it("lists summaries in reverse chronological order", async () => {
    const store = createMemorySummaryStore();
    await store.save({ summaryId: "a", roomId: "r", periodStart: "2026-01-01", periodEnd: "2026-01-02", title: "A", keyPoints: [], participantSummary: "", actionItems: [], messageCount: 1, generatedBy: "agent" });
    await store.save({ summaryId: "b", roomId: "r", periodStart: "2026-01-03", periodEnd: "2026-01-04", title: "B", keyPoints: [], participantSummary: "", actionItems: [], messageCount: 1, generatedBy: "agent" });
    const list = await store.list("r");
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe("B");
  });
});

describe("search index", () => {
  it("indexes and searches messages", async () => {
    const idx = createMemorySearchIndex();
    await idx.index("r1", "m1", "Hello world, this is a test", "user-1", "2026-01-01");
    await idx.index("r1", "m2", "Another message about testing", "user-2", "2026-01-02");
    const results = await idx.search("r1", "test");
    expect(results).toHaveLength(2);
  });

  it("ranks exact matches higher", async () => {
    const idx = createMemorySearchIndex();
    await idx.index("r1", "m1", "the cat sat on the mat", "user-1", "2026-01-01");
    await idx.index("r1", "m2", "cat food is expensive", "user-2", "2026-01-02");
    const results = await idx.search("r1", "cat");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].messageId).toBe("m1");
  });

  it("removes indexed messages", async () => {
    const idx = createMemorySearchIndex();
    await idx.index("r1", "m1", "test content", "u1", "2026-01-01");
    await idx.remove("m1");
    const results = await idx.search("r1", "test");
    expect(results).toHaveLength(0);
  });
});

describe("moderation engine", () => {
  it("allows clean content", () => {
    const engine = createModerationEngine({ rules: [{ name: "spam", patterns: [/buy now/i], action: "block", label: "spam" }], dlpEnabled: false });
    const results = engine.check("Hello, how are you?", { messageId: "m1", roomId: "r1", userId: "u1" });
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("allow");
  });

  it("blocks content matching rules", () => {
    const engine = createModerationEngine({ rules: [{ name: "spam", patterns: [/buy now/i], action: "block", label: "spam" }], dlpEnabled: false });
    const results = engine.check("Buy now! Limited offer.", { messageId: "m1", roomId: "r1", userId: "u1" });
    expect(results[0].action).toBe("block");
  });

  it("flags PII when DLP is enabled", () => {
    const engine = createModerationEngine({ rules: [], dlpEnabled: true });
    const results = engine.check("My email is test@example.com", { messageId: "m1", roomId: "r1", userId: "u1" });
    expect(results.some((r) => r.label === "PII detected")).toBe(true);
  });

  it("generates reports", () => {
    const engine = createModerationEngine({ rules: [{ name: "spam", patterns: [/viagra/i], action: "block", label: "pharma" }], dlpEnabled: false });
    engine.check("Buy viagra now", { messageId: "m1", roomId: "r1", userId: "u1" });
    const reports = engine.getReports("r1");
    expect(reports).toHaveLength(1);
    expect(reports[0].results[0].action).toBe("block");
  });
});

describe("translation cache", () => {
  it("caches translations", async () => {
    const cache = createMemoryTranslationCache();
    expect(await cache.get("hello", "en", "it")).toBeNull();
    await cache.set("hello", "en", "it", "ciao");
    expect(await cache.get("hello", "en", "it")).toBe("ciao");
  });
});
