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

describe("dispatchBillingRoutes checkout guard (audit M7)", () => {
  function checkoutRequest(body) {
    return new Request("http://127.0.0.1:8787/billing/checkout", {
      method: "POST",
      headers: {
        Authorization: "Bearer jwt",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  it("M7: refuses a second checkout while a subscription is live", async () => {
    const fetchCalls = [];
    globalThis.fetch = async (url) => {
      fetchCalls.push(url);
      return { json: async () => ({ id: "cs_x", url: "https://checkout.stripe.com/cs_x" }) };
    };
    const h = buildDeps({
      stripeKey: "sk_test",
      getProjectPlan: async () => ({
        projectId: "proj_1",
        planName: "starter",
        billingStatus: "active",
        stripeSubscriptionId: "sub_1",
      }),
    });
    const res = await dispatchBillingRoutes(
      checkoutRequest({ planName: "starter" }),
      new URL("http://127.0.0.1:8787/billing/checkout"),
      h,
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("already_subscribed");
    expect(fetchCalls).toHaveLength(0);
  });

  it("M7 control: a cancelled subscription can re-subscribe", async () => {
    const fetchCalls = [];
    globalThis.fetch = async (url) => {
      fetchCalls.push(url);
      return { json: async () => ({ id: "cs_y", url: "https://checkout.stripe.com/cs_y" }) };
    };
    const h = buildDeps({
      stripeKey: "sk_test",
      getProjectPlan: async () => ({
        projectId: "proj_1",
        planName: "free",
        billingStatus: "cancelled",
        stripeSubscriptionId: "sub_old",
      }),
    });
    const res = await dispatchBillingRoutes(
      checkoutRequest({ planName: "starter" }),
      new URL("http://127.0.0.1:8787/billing/checkout"),
      h,
    );
    expect(res.status).toBe(200);
    expect(fetchCalls).toHaveLength(1);
  });
});

describe("dispatchBillingRoutes checkout pricing (audit F-77/F-83)", () => {
  function checkoutRequest(body) {
    return new Request("http://127.0.0.1:8787/billing/checkout", {
      method: "POST",
      headers: {
        Authorization: "Bearer jwt",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  it("rejects a plan that is not self-serve purchasable", async () => {
    const h = buildDeps({ stripeKey: "sk_test" });
    const res = await dispatchBillingRoutes(
      checkoutRequest({ planName: "growth" }),
      new URL("http://127.0.0.1:8787/billing/checkout"),
      h,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("plan_not_purchasable");
  });

  it("charges the server-side price for the requested plan and sanitizes redirects", async () => {
    const captured = [];
    globalThis.fetch = async (url, init) => {
      captured.push({ url, params: new URLSearchParams(init.body) });
      return {
        json: async () => ({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" }),
      };
    };

    const h = buildDeps({ stripeKey: "sk_test" });
    const res = await dispatchBillingRoutes(
      checkoutRequest({
        planName: "pro",
        successUrl: "https://evil.example/phish",
        cancelUrl: "/billing?cancelled=1",
      }),
      new URL("http://127.0.0.1:8787/billing/checkout"),
      h,
    );
    expect(res.status).toBe(200);
    expect(captured).toHaveLength(1);
    const params = captured[0].params;
    expect(params.get("line_items[0][price_data][unit_amount]")).toBe("4999");
    expect(params.get("metadata[plan_name]")).toBe("pro");
    expect(params.get("success_url")).toBe("https://app.fluxychat.com/billing?success=1");
    expect(params.get("cancel_url")).toBe("https://app.fluxychat.com/billing?cancelled=1");
  });

  it("accepts redirects on the configured PUBLIC_APP_URL origin", async () => {
    const captured = [];
    globalThis.fetch = async (url, init) => {
      captured.push({ url, params: new URLSearchParams(init.body) });
      return {
        json: async () => ({ id: "cs_2", url: "https://checkout.stripe.com/cs_2" }),
      };
    };

    const h = buildDeps({ stripeKey: "sk_test" });
    h.env.PUBLIC_APP_URL = "https://chat.selfhost.example";
    const res = await dispatchBillingRoutes(
      checkoutRequest({
        planName: "starter",
        successUrl: "https://chat.selfhost.example/billing?success=1",
      }),
      new URL("http://127.0.0.1:8787/billing/checkout"),
      h,
    );
    expect(res.status).toBe(200);
    expect(captured[0].params.get("line_items[0][price_data][unit_amount]")).toBe("1999");
    expect(captured[0].params.get("success_url")).toBe(
      "https://chat.selfhost.example/billing?success=1",
    );
  });
});
