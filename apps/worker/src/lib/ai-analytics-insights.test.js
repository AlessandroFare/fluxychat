import { describe, it, expect, vi } from "vitest";
import { generateInsights, listInsights, getInsight, generateWeeklyDigest, deleteInsight } from "../lib/ai-analytics-insights.js";

function makeEnv(overrides = {}) {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
    },
    AI_BASE_URL: "https://api.openai.com",
    AI_API_KEY: "test-key",
    AI_ANALYTICS_ENABLED: "true",
    AI_MODEL: "gpt-4o-mini",
    ...overrides,
  };
}

describe("ai-analytics-insights", () => {
  describe("generateInsights", () => {
    it("returns error when feature disabled", async () => {
      const env = makeEnv({ AI_ANALYTICS_ENABLED: "false" });
      const result = await generateInsights(env, { projectId: "p1", insightType: "engagement" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("analytics_insights_disabled");
    });

    it("returns error for invalid insight type", async () => {
      const env = makeEnv();
      const result = await generateInsights(env, { projectId: "p1", insightType: "invalid" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("invalid_insight_type");
    });

    it("returns error when AI API fails", async () => {
      const env = makeEnv();
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve("bad") });
      const result = await generateInsights(env, { projectId: "p1", insightType: "engagement" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("ai_api_error");
      global.fetch = undefined;
    });

    it("generates engagement insight successfully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify({ title: "Engagement Peak", summary: "Most activity at 10am", keyFindings: ["Peak at 10am"], recommendations: ["Send messages at 10am"] }) } }],
        }),
      });
      const env = makeEnv();
      const result = await generateInsights(env, { projectId: "p1", insightType: "engagement" });
      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.title).toBe("Engagement Peak");
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      global.fetch = undefined;
    });

    it("generates activity insight", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify({ title: "Activity Trends", summary: "Messages increasing" }) } }],
        }),
      });
      const env = makeEnv();
      const result = await generateInsights(env, { projectId: "p1", insightType: "activity" });
      expect(result.ok).toBe(true);
      expect(result.insightType).toBe("activity");
      global.fetch = undefined;
    });

    it("generates performance insight", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify({ title: "Performance Report", summary: "All systems healthy" }) } }],
        }),
      });
      const env = makeEnv();
      const result = await generateInsights(env, { projectId: "p1", insightType: "performance" });
      expect(result.ok).toBe(true);
      expect(result.insightType).toBe("performance");
      global.fetch = undefined;
    });

    it("generates retention insight", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify({ title: "Retention Analysis", summary: "7-day retention at 45%" }) } }],
        }),
      });
      const env = makeEnv();
      const result = await generateInsights(env, { projectId: "p1", insightType: "retention" });
      expect(result.ok).toBe(true);
      expect(result.insightType).toBe("retention");
      global.fetch = undefined;
    });

    it("generates content insight", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify({ title: "Content Trends", summary: "Voice messages growing" }) } }],
        }),
      });
      const env = makeEnv();
      const result = await generateInsights(env, { projectId: "p1", insightType: "content" });
      expect(result.ok).toBe(true);
      expect(result.insightType).toBe("content");
      global.fetch = undefined;
    });

    it("returns error on empty AI response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: "" } }] }),
      });
      const env = makeEnv();
      const result = await generateInsights(env, { projectId: "p1", insightType: "engagement" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("empty_ai_response");
      global.fetch = undefined;
    });

    it("handles malformed AI JSON gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: "not json at all" } }] }),
      });
      const env = makeEnv();
      const result = await generateInsights(env, { projectId: "p1", insightType: "engagement" });
      expect(result.ok).toBe(true);
      expect(result.summary).toBe("not json at all");
      global.fetch = undefined;
    });
  });

  describe("listInsights", () => {
    it("returns empty array for project with no insights", async () => {
      const env = makeEnv();
      const items = await listInsights(env, { projectId: "p1" });
      expect(items).toEqual([]);
    });
  });

  describe("getInsight", () => {
    it("returns null for nonexistent id", async () => {
      const env = makeEnv();
      const result = await getInsight(env, { projectId: "p1", id: "nonexistent" });
      expect(result).toBeNull();
    });
  });

  describe("deleteInsight", () => {
    it("returns not_found for nonexistent id", async () => {
      const env = makeEnv();
      const result = await deleteInsight(env, { projectId: "p1", id: "nonexistent" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });

  describe("generateWeeklyDigest", () => {
    it("generates multiple insights for weekly digest", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify({ title: "Weekly Report", summary: "Good week" }) } }],
        }),
      });
      const env = makeEnv();
      const result = await generateWeeklyDigest(env, { projectId: "p1" });
      expect(result.ok).toBe(true);
      expect(result.insights.length).toBe(3);
      global.fetch = undefined;
    });
  });
});
