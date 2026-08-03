import { describe, it, expect, vi } from "vitest";
import { getTenantUsageSnapshot } from "./tenant-usage.js";

function makeEnv(rows = {}) {
  const {
    usageMonthly = [],
    mau = 12,
    storageBytes = 5_000_000,
    storageFiles = 42,
    rooms = 3,
    messagesTotal = 1000,
    ops = [],
    plan = {
      project_id: "p1",
      plan_name: "growth",
      billing_status: "active",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      message_limit_monthly: 200000,
      agent_invoke_limit_monthly: 5000,
      webhook_delivery_limit_monthly: 50000,
      pricing_version: "v1",
      manually_overridden: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  } = rows;

  return {
    DB: {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => {
            if (sql.includes("project_usage_monthly")) {
              return { results: usageMonthly };
            }
            if (sql.includes("operational_metrics")) {
              return { results: ops };
            }
            return { results: [] };
          }),
          first: vi.fn(async () => {
            if (sql.includes("COUNT(DISTINCT user_id)")) return { mau };
            if (sql.includes("FROM attachments")) return { bytes: storageBytes, files: storageFiles };
            if (sql.includes("FROM rooms")) return { rooms };
            if (sql.includes("FROM messages WHERE project_id")) return { total: messagesTotal };
            if (sql.includes("FROM project_plans")) return plan;
            return null;
          }),
          run: vi.fn(async () => ({})),
        })),
      })),
    },
  };
}

describe("tenant-usage", () => {
  it("returns monthly usage, MAU, storage and cost estimate", async () => {
    const env = makeEnv({
      usageMonthly: [
        { metric_name: "messages_created", used_value: 1500 },
        { metric_name: "agent_invokes", used_value: 25 },
        { metric_name: "webhook_deliveries", used_value: 300 },
      ],
      ops: [{ metric_name: "requests_total", total: 9000 }],
    });

    const snapshot = await getTenantUsageSnapshot(env, "p1");

    expect(snapshot.projectId).toBe("p1");
    expect(snapshot.monthlyUsage.messagesCreated).toBe(1500);
    expect(snapshot.monthlyUsage.agentInvokes).toBe(25);
    expect(snapshot.totals.mau).toBe(12);
    expect(snapshot.totals.storageBytes).toBe(5_000_000);
    expect(snapshot.plan?.planName).toBe("growth");
    expect(snapshot.costEstimate.estimatedUsd).toBeGreaterThan(0);
    expect(snapshot.opsLast30d.requests_total).toBe(9000);
  });
});
