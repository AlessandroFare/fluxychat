import { timingSafeEqual } from "./crypto-timing.js";
import { normalizePlanName, planLimitsForTier } from "./plan-tier-limits.js";

export async function resolveStripeProjectId(env, options) {
  const direct = typeof options?.projectId === "string" ? options.projectId : "";
  if (direct) return direct;
  const customerId = typeof options?.customerId === "string" ? options.customerId : "";
  const subscriptionId =
    typeof options?.subscriptionId === "string" ? options.subscriptionId : "";

  if (subscriptionId) {
    const row = await env.DB.prepare(
      "SELECT project_id FROM project_plans WHERE stripe_subscription_id = ? LIMIT 1"
    )
      .bind(subscriptionId)
      .first();
    if (row?.project_id) return row.project_id;
  }
  if (customerId) {
    const row = await env.DB.prepare(
      "SELECT project_id FROM project_plans WHERE stripe_customer_id = ? LIMIT 1"
    )
      .bind(customerId)
      .first();
    if (row?.project_id) return row.project_id;
  }
  return null;
}

export async function upsertProjectPlanFromStripe(env, args) {
  const now = new Date().toISOString();
  const planName = normalizePlanName(args.planName || "starter");
  const billingStatus = String(args.billingStatus || "active");
  const pricingVersion = env.DEFAULT_PRICING_VERSION || "v1";
  const limits = planLimitsForTier(env, planName);

  const existing = await env.DB.prepare(
    "SELECT project_id FROM project_plans WHERE project_id = ? LIMIT 1"
  )
    .bind(args.projectId)
    .first();

  if (existing?.project_id) {
    const existingRow = await env.DB.prepare(
      "SELECT manually_overridden, message_limit_monthly, agent_invoke_limit_monthly, webhook_delivery_limit_monthly FROM project_plans WHERE project_id = ? LIMIT 1"
    )
      .bind(args.projectId)
      .first();

    if (existingRow && !existingRow.manually_overridden) {
      await env.DB.prepare(
        "UPDATE project_plans SET plan_name = ?, billing_status = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id), message_limit_monthly = ?, agent_invoke_limit_monthly = ?, webhook_delivery_limit_monthly = ?, updated_at = ? WHERE project_id = ?"
      )
        .bind(
          planName,
          billingStatus,
          args.stripeCustomerId || null,
          args.stripeSubscriptionId || null,
          limits.messageLimitMonthly,
          limits.agentInvokeLimitMonthly,
          limits.webhookDeliveryLimitMonthly,
          now,
          args.projectId
        )
        .run();
    } else {
      await env.DB.prepare(
        "UPDATE project_plans SET plan_name = ?, billing_status = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id), updated_at = ? WHERE project_id = ?"
      )
        .bind(
          planName,
          billingStatus,
          args.stripeCustomerId || null,
          args.stripeSubscriptionId || null,
          now,
          args.projectId
        )
        .run();
    }
    return;
  }

  await env.DB.prepare(
    "INSERT INTO project_plans (project_id, plan_name, billing_status, stripe_customer_id, stripe_subscription_id, message_limit_monthly, agent_invoke_limit_monthly, webhook_delivery_limit_monthly, pricing_version, manually_overridden, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      args.projectId,
      planName,
      billingStatus,
      args.stripeCustomerId || null,
      args.stripeSubscriptionId || null,
      limits.messageLimitMonthly,
      limits.agentInvokeLimitMonthly,
      limits.webhookDeliveryLimitMonthly,
      pricingVersion,
      0,
      now,
      now
    )
    .run();
}

export async function verifyStripeWebhookSignatureAsync(
  payload,
  signatureHeader,
  secret
) {
  try {
    const parts = {};
    for (const element of signatureHeader.split(",")) {
      const [key, ...rest] = element.split("=");
      parts[key.trim()] = rest.join("=");
    }
    const timestamp = Number(parts.t);
    const v1Signature = parts.v1;
    if (!timestamp || !v1Signature) {
      return { valid: false, error: "missing t or v1 in Stripe-Signature", timestamp: null };
    }

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload)
    );
    const expectedHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const valid = await timingSafeEqual(expectedHex, v1Signature);
    return { valid, timestamp, error: valid ? null : "signature_mismatch" };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "verification_error",
      timestamp: null,
    };
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Handle POST /webhooks/stripe (idempotent event processing).
 */
export async function handleStripeWebhookPost(request, env, h) {
  const { json, logError, logInfo } = h;
  const signatureHeader = request.headers.get("Stripe-Signature") || "";
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET || "";
  const rawBody = await request.text();

  if (webhookSecret) {
    if (!signatureHeader) {
      logError("billing.stripe_missing_signature", "No Stripe-Signature header");
      return json({ error: "missing signature" }, { status: 401 });
    }
    const verification = await verifyStripeWebhookSignatureAsync(
      rawBody,
      signatureHeader,
      webhookSecret
    );
    if (!verification.valid) {
      logError(
        "billing.stripe_invalid_signature",
        verification.error || "Signature mismatch"
      );
      return json({ error: "invalid signature" }, { status: 401 });
    }
    if (
      verification.timestamp &&
      Math.abs(Date.now() / 1000 - verification.timestamp) > 300
    ) {
      logError("billing.stripe_replay", "Timestamp too old");
      return json({ error: "stale webhook" }, { status: 401 });
    }
    logInfo("billing.stripe_webhook_verified", { timestamp: verification.timestamp });
  } else {
    logInfo(
      "billing.stripe_webhook_no_secret",
      "STRIPE_WEBHOOK_SECRET not configured, skipping verification"
    );
  }

  const body = safeJsonParse(rawBody);
  if (!body?.type) {
    return json({ error: "invalid webhook" }, { status: 400 });
  }
  const eventId = typeof body.id === "string" ? body.id : null;
  if (eventId) {
    const seen = await env.DB.prepare(
      "INSERT OR IGNORE INTO stripe_webhook_events (id, event_type, created_at) VALUES (?, ?, ?)"
    )
      .bind(eventId, String(body.type || "unknown"), new Date().toISOString())
      .run();
    if (!Number(seen?.meta?.changes || 0)) {
      return json({ received: true, duplicate: true, id: eventId, type: body.type });
    }
  }

  const eventType = body.type;
  const customerId = body.data?.object?.customer;
  const subscriptionId = body.data?.object?.id;
  const status = body.data?.object?.status;

  logInfo("billing.stripe_event", {
    eventType,
    customerId,
    subscriptionId,
    status,
  });

  if (eventType === "checkout.session.completed") {
    const projectId = await resolveStripeProjectId(env, {
      projectId: body.data?.object?.client_reference_id,
      customerId: body.data?.object?.customer,
      subscriptionId: body.data?.object?.subscription,
    });
    const planName = body.data?.object?.metadata?.plan_name || "starter";
    const stripeCustomerId = body.data?.object?.customer;
    const stripeSubId = body.data?.object?.subscription;
    if (projectId) {
      if (eventId) {
        const gate = await env.DB.prepare(
          "INSERT OR IGNORE INTO stripe_webhook_events (id, event_type, created_at) VALUES (?, ?, ?)"
        )
          .bind(eventId, "checkout.session.completed", new Date().toISOString())
          .run();
        if (!Number(gate?.meta?.changes || 0)) {
          return json({ received: true, duplicate: true, id: eventId, type: eventType });
        }
      }
      await upsertProjectPlanFromStripe(env, {
        projectId,
        planName,
        billingStatus: "active",
        stripeCustomerId: stripeCustomerId || null,
        stripeSubscriptionId: stripeSubId || null,
      });
    }
  }

  if (eventType === "customer.subscription.updated") {
    const projectId = await resolveStripeProjectId(env, {
      projectId: body.data?.object?.metadata?.project_id,
      customerId,
      subscriptionId,
    });
    const planName = body.data?.object?.metadata?.plan_name || "starter";
    if (projectId) {
      const s = String(status || "");
      const billingStatus =
        s === "active"
          ? "active"
          : s === "trialing"
            ? "active"
            : s === "past_due"
              ? "past_due"
              : s === "canceled"
                ? "cancelled"
                : s === "unpaid"
                  ? "past_due"
                  : "active";
      await upsertProjectPlanFromStripe(env, {
        projectId,
        planName,
        billingStatus,
        stripeCustomerId: customerId || null,
        stripeSubscriptionId: subscriptionId || null,
      });
    }
  }

  if (eventType === "customer.subscription.deleted") {
    const projectId = await resolveStripeProjectId(env, {
      projectId: body.data?.object?.metadata?.project_id,
      customerId,
      subscriptionId,
    });
    if (projectId) {
      await upsertProjectPlanFromStripe(env, {
        projectId,
        planName: "free",
        billingStatus: "cancelled",
        stripeCustomerId: customerId || null,
        stripeSubscriptionId: subscriptionId || null,
      });
    }
  }

  return json({ received: true, type: eventType });
}
