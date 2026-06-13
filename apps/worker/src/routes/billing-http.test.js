import { describe, expect, it, vi } from "vitest";
import { dispatchBillingRoutes } from "./billing-http.js";

function buildDeps(overrides = {}) {
  const corsHeaders = { "access-control-allow-origin": "*" };
  const env = {
    DB: overrides.db ?? {
      prepare() {
        return {
          bind() {
            return { all: async () => ({ results: [] }) };
          },
        };
      },
    },
    STRIPE_SECRET_KEY: overrides.stripeKey ?? "",
  };

  return {
    env,
    corsHeaders,
    json: (data, init = {}) =>
      new Response(JSON.stringify(data), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...corsHeaders, ...(init.headers || {}) },
      }),
    requestLogCtx: { traceId: "t" },
    verifyJwt: overrides.verifyJwt ?? (async () => ({ userId: "user_1", projectId: "proj_1" })),
    logError: () => {},
    writeAuditEvent: async () => {},
    getProjectPlan:
      overrides.getProjectPlan ??
      (async () => ({
        projectId: "proj_1",
        planName: "free",
        billingStatus: "manual",
      })),
    monthKeyUtc: () => "2026-05",
  };
}

describe("dispatchBillingRoutes", () => {
  it("returns null for non-matching path", async () => {
    const h = buildDeps();
    const req = new Request("http://127.0.0.1:8787/health", { method: "GET" });
    const res = await dispatchBillingRoutes(req, new URL(req.url), h);
    expect(res).toBeNull();
  });

  it("GET /billing/plan returns 401 without auth", async () => {
    const h = buildDeps({ verifyJwt: async () => null });
    const req = new Request("http://127.0.0.1:8787/billing/plan", { method: "GET" });
    const res = await dispatchBillingRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(401);
  });

  it("GET /billing/plan returns plan and usage", async () => {
    const usageRows = [
      { metric_name: "messages_created", used_value: 42 },
      { metric_name: "agent_invokes", used_value: 3 },
    ];
    const db = {
      prepare(sql) {
        return {
          bind() {
            return {
              all: async () => {
                if (sql.includes("project_usage_monthly")) {
                  return { results: usageRows };
                }
                return { results: [] };
              },
            };
          },
        };
      },
    };
    const h = buildDeps({ db, stripeKey: "sk_test" });
    const req = new Request("http://127.0.0.1:8787/billing/plan", {
      method: "GET",
      headers: { Authorization: "Bearer jwt" },
    });
    const res = await dispatchBillingRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.planName).toBe("free");
    expect(body.usage.messages_created).toBe(42);
    expect(body.paymentsEnabled).toBe(true);
    expect(body.monthKey).toBe("2026-05");
  });

  it("POST /billing/checkout returns 501 when Stripe is not configured", async () => {
    const h = buildDeps();
    const req = new Request("http://127.0.0.1:8787/billing/checkout", {
      method: "POST",
      headers: {
        Authorization: "Bearer jwt",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ planName: "starter" }),
    });
    const res = await dispatchBillingRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe("billing_not_configured");
  });
});
