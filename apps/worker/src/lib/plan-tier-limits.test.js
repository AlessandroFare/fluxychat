import { describe, expect, it } from "vitest";
import {
  ALLOWED_PLAN_NAMES,
  CANONICAL_TIER_LIMITS,
  FREE_TIER_LIMITS,
  normalizePlanName,
  planLimitsForTier,
} from "./plan-tier-limits.js";

describe("plan-tier-limits", () => {
  it("normalizes unknown plan names to free", () => {
    expect(normalizePlanName("enterprise")).toBe("free");
    expect(normalizePlanName("PRO")).toBe("pro");
  });

  it("returns tier caps for starter and pro", () => {
    const env = {};
    expect(planLimitsForTier(env, "starter").messageLimitMonthly).toBe(500_000);
    expect(planLimitsForTier(env, "pro").agentInvokeLimitMonthly).toBe(100_000);
  });

  it("exposes frozen canonical tier limits (P0-1 source of truth)", () => {
    expect(ALLOWED_PLAN_NAMES).toEqual(new Set(["free", "starter", "pro"]));
    expect(CANONICAL_TIER_LIMITS.starter).toEqual({
      messageLimitMonthly: 500_000,
      agentInvokeLimitMonthly: 10_000,
      webhookDeliveryLimitMonthly: 100_000,
    });
    expect(CANONICAL_TIER_LIMITS.pro).toEqual({
      messageLimitMonthly: 5_000_000,
      agentInvokeLimitMonthly: 100_000,
      webhookDeliveryLimitMonthly: 1_000_000,
    });
    expect(() => {
      CANONICAL_TIER_LIMITS.starter.messageLimitMonthly = 1;
    }).toThrow();
    const env = {};
    expect(planLimitsForTier(env, "starter")).toEqual(CANONICAL_TIER_LIMITS.starter);
    expect(planLimitsForTier(env, "pro")).toEqual(CANONICAL_TIER_LIMITS.pro);
  });

  it("uses audited free-tier defaults when env overrides are absent", () => {
    const env = {};
    expect(planLimitsForTier(env, "free")).toEqual(FREE_TIER_LIMITS);
  });
});
