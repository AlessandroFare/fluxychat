import { describe, expect, it } from "vitest";
import { resolveSanitizedTier, sanitizeProjectPlans } from "./sanitize-project-plans.js";

describe("resolveSanitizedTier", () => {
  const env = {
    HOSTED_MULTI_TENANT: "true",
    FLUXY_PLATFORM_PROJECT_ID: "platform-1",
    QUOTA_MESSAGES_PER_MONTH: "50000",
  };

  it("demotes unpaid pro to free for tenants", () => {
    expect(
      resolveSanitizedTier(
        {
          project_id: "tenant-1",
          plan_name: "pro",
          billing_status: "manual",
          stripe_subscription_id: null,
        },
        env,
      ),
    ).toBe("free");
  });

  it("keeps paid stripe tier", () => {
    expect(
      resolveSanitizedTier(
        {
          project_id: "tenant-1",
          plan_name: "starter",
          billing_status: "active",
          stripe_subscription_id: "sub_123",
        },
        env,
      ),
    ).toBe("starter");
  });

  it("does not demote platform project", () => {
    expect(
      resolveSanitizedTier(
        {
          project_id: "platform-1",
          plan_name: "pro",
          billing_status: "manual",
          stripe_subscription_id: null,
        },
        env,
      ),
    ).toBe("pro");
  });
});

describe("sanitizeProjectPlans", () => {
  it("dry-run reports rows that would change", async () => {
    const plans = [
      {
        project_id: "t1",
        plan_name: "pro",
        billing_status: "manual",
        stripe_subscription_id: null,
        message_limit_monthly: 9_999_999,
        agent_invoke_limit_monthly: 9_999_999,
        webhook_delivery_limit_monthly: 9_999_999,
        manually_overridden: 1,
        pricing_version: "v1",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const env = {
      HOSTED_MULTI_TENANT: "true",
      FLUXY_PLATFORM_PROJECT_ID: "platform-1",
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async all() {
                  if (sql.includes("FROM project_plans")) {
                    return { results: [...plans] };
                  }
                  return { results: [] };
                },
                async run() {
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };

    const result = await sanitizeProjectPlans(env, { dryRun: true });
    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.changes[0].after.planName).toBe("free");
    expect(result.changes[0].after.messageLimitMonthly).toBe(50_000);
    expect(plans[0].message_limit_monthly).toBe(9_999_999);
  });

  it("applies updates when not dry-run", async () => {
    const plans = [
      {
        project_id: "t1",
        plan_name: "enterprise",
        billing_status: "manual",
        stripe_subscription_id: null,
        message_limit_monthly: 1,
        agent_invoke_limit_monthly: 1,
        webhook_delivery_limit_monthly: 1,
        manually_overridden: 1,
        pricing_version: "v1",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async all() {
                  return { results: [...plans] };
                },
                async run() {
                  if (sql.includes("UPDATE project_plans")) {
                    plans[0].plan_name = args[0];
                    plans[0].message_limit_monthly = args[1];
                    plans[0].agent_invoke_limit_monthly = args[2];
                    plans[0].webhook_delivery_limit_monthly = args[3];
                    plans[0].manually_overridden = 0;
                  }
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };

    const result = await sanitizeProjectPlans(env, { dryRun: false, demoteUnpaid: false });
    expect(result.updated).toBe(1);
    expect(plans[0].plan_name).toBe("free");
    expect(plans[0].manually_overridden).toBe(0);
  });
});
