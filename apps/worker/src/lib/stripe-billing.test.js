import { describe, expect, it, vi, beforeEach } from "vitest";
import { CANONICAL_TIER_LIMITS } from "./plan-tier-limits.js";
import {
  handleStripeWebhookPost,
  resolveStripeProjectId,
  upsertProjectPlanFromStripe,
  verifyStripeWebhookSignatureAsync,
} from "./stripe-billing.js";

async function buildStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

function createMockDb() {
  const projectPlans = new Map();
  const stripeEvents = new Set();

  return {
    projectPlans,
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("FROM project_plans WHERE stripe_subscription_id")) {
                  const subId = params[0];
                  for (const row of projectPlans.values()) {
                    if (row.stripe_subscription_id === subId) return row;
                  }
                  return null;
                }
                if (sql.includes("FROM project_plans WHERE stripe_customer_id")) {
                  const custId = params[0];
                  for (const row of projectPlans.values()) {
                    if (row.stripe_customer_id === custId) return row;
                  }
                  return null;
                }
                if (sql.includes("FROM project_plans WHERE project_id = ?")) {
                  return projectPlans.get(params[0]) || null;
                }
                return null;
              },
              async run() {
                if (sql.includes("INSERT OR IGNORE INTO stripe_webhook_events")) {
                  const id = params[0];
                  if (stripeEvents.has(id)) {
                    return { meta: { changes: 0 } };
                  }
                  stripeEvents.add(id);
                  return { meta: { changes: 1 } };
                }
                if (sql.startsWith("INSERT INTO project_plans")) {
                  const [
                    project_id,
                    plan_name,
                    billing_status,
                    stripe_customer_id,
                    stripe_subscription_id,
                    message_limit_monthly,
                    agent_invoke_limit_monthly,
                    webhook_delivery_limit_monthly,
                  ] = params;
                  projectPlans.set(project_id, {
                    project_id,
                    plan_name,
                    billing_status,
                    stripe_customer_id,
                    stripe_subscription_id,
                    message_limit_monthly,
                    agent_invoke_limit_monthly,
                    webhook_delivery_limit_monthly,
                    manually_overridden: 0,
                    pricing_version: "v1",
                  });
                  return { meta: { changes: 1 } };
                }
                if (sql.startsWith("UPDATE project_plans SET plan_name")) {
                  const projectId = params[params.length - 1];
                  const row = projectPlans.get(projectId);
                  if (!row) return { meta: { changes: 0 } };
                  row.plan_name = params[0];
                  row.billing_status = params[1];
                  if (params[2]) row.stripe_customer_id = params[2];
                  if (params[3]) row.stripe_subscription_id = params[3];
                  if (params.length >= 9) {
                    row.message_limit_monthly = params[4];
                    row.agent_invoke_limit_monthly = params[5];
                    row.webhook_delivery_limit_monthly = params[6];
                  }
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              },
            };
          },
        };
      },
    },
  };
}

describe("stripe-billing (P1 ENG-10)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handleStripeWebhookPost rejects when STRIPE_WEBHOOK_SECRET is missing", async () => {
    const store = createMockDb();
    const env = { ...store, DEFAULT_PRICING_VERSION: "v1" };
    const h = {
      json: (body, init) =>
        new Response(JSON.stringify(body), {
          status: init?.status || 200,
          headers: { "Content-Type": "application/json" },
        }),
      logError: vi.fn(),
      logInfo: vi.fn(),
    };

    const res = await handleStripeWebhookPost(
      new Request("https://worker.example/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ type: "checkout.session.completed" }),
      }),
      env,
      h,
    );
    expect(res.status).toBe(503);
  });

  it("resolveStripeProjectId prefers direct projectId", async () => {
    const { DB } = createMockDb();
    await expect(
      resolveStripeProjectId({ DB }, { projectId: "proj_a" }),
    ).resolves.toBe("proj_a");
  });

  it("upsertProjectPlanFromStripe inserts starter limits for new tenant", async () => {
    const store = createMockDb();
    await upsertProjectPlanFromStripe(store, {
      projectId: "proj_new",
      planName: "starter",
      billingStatus: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
    const row = store.projectPlans.get("proj_new");
    expect(row.plan_name).toBe("starter");
    expect(row.message_limit_monthly).toBe(
      CANONICAL_TIER_LIMITS.starter.messageLimitMonthly,
    );
    expect(row.agent_invoke_limit_monthly).toBe(
      CANONICAL_TIER_LIMITS.starter.agentInvokeLimitMonthly,
    );
    expect(row.webhook_delivery_limit_monthly).toBe(
      CANONICAL_TIER_LIMITS.starter.webhookDeliveryLimitMonthly,
    );
  });

  it("handleStripeWebhookPost upserts plan on checkout.session.completed", async () => {
    const store = createMockDb();
    const webhookSecret = "whsec_test_secret";
    const env = { ...store, DEFAULT_PRICING_VERSION: "v1", STRIPE_WEBHOOK_SECRET: webhookSecret };
    const h = {
      json: (body, init) =>
        new Response(JSON.stringify(body), {
          status: init?.status || 200,
          headers: { "Content-Type": "application/json" },
        }),
      logError: vi.fn(),
      logInfo: vi.fn(),
    };

    const event = {
      id: "evt_checkout_1",
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: "proj_checkout",
          customer: "cus_checkout",
          subscription: "sub_checkout",
          metadata: { plan_name: "pro" },
        },
      },
    };

    const eventBody = JSON.stringify(event);
    const signature = await buildStripeSignature(eventBody, webhookSecret);

    const res = await handleStripeWebhookPost(
      new Request("https://worker.example/webhooks/stripe", {
        method: "POST",
        headers: { "Stripe-Signature": signature },
        body: eventBody,
      }),
      env,
      h,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);

    const row = store.projectPlans.get("proj_checkout");
    expect(row).toBeTruthy();
    expect(row.plan_name).toBe("pro");
    expect(row.billing_status).toBe("active");
    expect(row.message_limit_monthly).toBe(
      CANONICAL_TIER_LIMITS.pro.messageLimitMonthly,
    );
  });

  it("handleStripeWebhookPost is idempotent for duplicate event ids", async () => {
    const store = createMockDb();
    const webhookSecret = "whsec_test_secret_dup";
    const env = { ...store, DEFAULT_PRICING_VERSION: "v1", STRIPE_WEBHOOK_SECRET: webhookSecret };
    const h = {
      json: (body, init) =>
        new Response(JSON.stringify(body), {
          status: init?.status || 200,
          headers: { "Content-Type": "application/json" },
        }),
      logError: vi.fn(),
      logInfo: vi.fn(),
    };

    const event = {
      id: "evt_dup",
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: "proj_dup",
          customer: "cus_dup",
          subscription: "sub_dup",
          metadata: { plan_name: "starter" },
        },
      },
    };

    const eventBody = JSON.stringify(event);
    const signature = await buildStripeSignature(eventBody, webhookSecret);

    const req = () =>
      new Request("https://worker.example/webhooks/stripe", {
        method: "POST",
        headers: { "Stripe-Signature": signature },
        body: eventBody,
      });

    await handleStripeWebhookPost(req(), env, h);
    const second = await handleStripeWebhookPost(req(), env, h);
    const body = await second.json();
    expect(body.duplicate).toBe(true);
    expect(store.projectPlans.size).toBe(1);
  });
});
