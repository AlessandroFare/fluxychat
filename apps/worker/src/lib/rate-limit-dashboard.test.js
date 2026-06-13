import { describe, it, expect, vi } from "vitest";
import { recordRateLimitEvent, getRateLimitSummary, getRateLimitThresholds, getRecentDenials } from "../lib/rate-limit-dashboard.js";

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
    ...overrides,
  };
}

describe("rate-limit-dashboard", () => {
  describe("recordRateLimitEvent", () => {
    it("records event without error", async () => {
      const env = makeEnv();
      await recordRateLimitEvent(env, {
        projectId: "p1", key: "msg:user1", limit: 100, windowSeconds: 60,
        allowed: true, currentCount: 1, retryAfterSeconds: 0,
      });
      expect(env.DB.prepare).toHaveBeenCalled();
    });

    it("records denied event", async () => {
      const env = makeEnv();
      await recordRateLimitEvent(env, {
        projectId: "p1", key: "msg:user1", limit: 100, windowSeconds: 60,
        allowed: false, currentCount: 100, retryAfterSeconds: 30, reason: "limit_exceeded",
      });
      expect(env.DB.prepare).toHaveBeenCalled();
    });
  });

  describe("getRateLimitSummary", () => {
    it("returns zero summary for empty project", async () => {
      const env = makeEnv();
      const summary = await getRateLimitSummary(env, { projectId: "p1" });
      expect(summary.totalRequests).toBe(0);
      expect(summary.totalDenied).toBe(0);
      expect(summary.denialRate).toBe("0%");
      expect(summary.byKey).toEqual([]);
      expect(summary.hourly).toEqual([]);
    });

    it("respects window parameter", async () => {
      const env = makeEnv();
      const summary = await getRateLimitSummary(env, { projectId: "p1", windowMinutes: 30 });
      expect(summary.windowMinutes).toBe(30);
    });
  });

  describe("getRateLimitThresholds", () => {
    it("returns empty thresholds for project with no events", async () => {
      const env = makeEnv();
      const result = await getRateLimitThresholds(env, { projectId: "p1" });
      expect(result).toEqual([]);
    });
  });

  describe("getRecentDenials", () => {
    it("returns empty denials for project with no events", async () => {
      const env = makeEnv();
      const denials = await getRecentDenials(env, { projectId: "p1" });
      expect(denials).toEqual([]);
    });

    it("respects limit parameter", async () => {
      const env = makeEnv();
      const denials = await getRecentDenials(env, { projectId: "p1", limit: 10 });
      expect(denials).toEqual([]);
    });
  });
});
