import { describe, expect, it } from "vitest";
import {
  CANONICAL_TIER_LIMITS,
  FREE_TIER_LIMITS,
  PUBLIC_PLAN_CATALOG,
  SALES_PLAN_CATALOG,
} from "./plan-catalog";

describe("plan-catalog (P0-1 pricing source of truth)", () => {
  it("renders every canonical tier in the public catalog with matching numbers", () => {
    // Free
    expect(PUBLIC_PLAN_CATALOG.free.messages).toBe(FREE_TIER_LIMITS.messageLimitMonthly);
    expect(PUBLIC_PLAN_CATALOG.free.agents).toBe(FREE_TIER_LIMITS.agentInvokeLimitMonthly);
    expect(PUBLIC_PLAN_CATALOG.free.webhooks).toBe(FREE_TIER_LIMITS.webhookDeliveryLimitMonthly);

    // Starter / Pro
    for (const tier of ["starter", "pro"] as const) {
      const row = PUBLIC_PLAN_CATALOG[tier];
      const limits = CANONICAL_TIER_LIMITS[tier];
      expect(row.messages).toBe(limits.messageLimitMonthly);
      expect(row.agents).toBe(limits.agentInvokeLimitMonthly);
      expect(row.webhooks).toBe(limits.webhookDeliveryLimitMonthly);
    }
  });

  it("keeps canonical tier numbers in the audited set (regression guard)", () => {
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
  });

  it("free catalog row uses the audited defaults (50k/1k/10k)", () => {
    expect(PUBLIC_PLAN_CATALOG.free.messages).toBe(50_000);
    expect(PUBLIC_PLAN_CATALOG.free.agents).toBe(1_000);
    expect(PUBLIC_PLAN_CATALOG.free.webhooks).toBe(10_000);
  });

  it("free row has the $0/mo price label", () => {
    expect(PUBLIC_PLAN_CATALOG.free.price).toBe("$0/mo");
  });

  it("starter row has the audited $19.99/mo label", () => {
    expect(PUBLIC_PLAN_CATALOG.starter.price).toBe("$19.99/mo");
  });

  it("pro row has the audited $49.99/mo label", () => {
    expect(PUBLIC_PLAN_CATALOG.pro.price).toBe("$49.99/mo");
  });

  it("sales catalog contains Growth / Business / Enterprise tiers (sales-led)", () => {
    const labels = SALES_PLAN_CATALOG.map((row) => row.label);
    expect(labels).toEqual(["Growth", "Business", "Enterprise"]);
    for (const row of SALES_PLAN_CATALOG) {
      // Sales-led tiers must NOT collide with self-serve keys.
      expect(Object.keys(PUBLIC_PLAN_CATALOG)).not.toContain(row.label.toLowerCase());
      expect(row.cta.length).toBeGreaterThan(0);
      expect(row.href).toMatch(/^mailto:/);
    }
  });

  it("canonical limits are frozen at runtime", () => {
    expect(() => {
      // @ts-expect-error -- intentionally mutating a frozen object in test
      CANONICAL_TIER_LIMITS.starter.messageLimitMonthly = 1;
    }).toThrow();
  });
});
