/**
 * HTTP handlers: authenticated Stripe billing helpers (not /webhooks/stripe).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";

export async function dispatchBillingRoutes(request, url, h) {
  const {
    env,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwt,
    writeAuditEvent,
    logError,
    getProjectPlan,
    monthKeyUtc,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwt",
    "writeAuditEvent",
    "logError",
    "getProjectPlan",
    "monthKeyUtc",
  ]);

  async function jwtAuth() {
    return verifyJwt(request).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
  }

  if (url.pathname === "/billing/plan" && request.method === "GET") {
    const auth = await jwtAuth();
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const plan = await getProjectPlan(env, auth.projectId);
    const monthKey = monthKeyUtc();
    const usageRows = await env.DB.prepare(
      "SELECT metric_name, used_value FROM project_usage_monthly WHERE project_id = ? AND month_key = ?"
    )
      .bind(auth.projectId, monthKey)
      .all();
    const usage = {};
    for (const row of usageRows.results || []) {
      usage[row.metric_name] = Number(row.used_value);
    }
    return json({
      plan: plan || { projectId: auth.projectId, planName: "free", billingStatus: "manual" },
      usage,
      monthKey,
      paymentsEnabled: Boolean(env.STRIPE_SECRET_KEY),
    });
  }

  if (url.pathname === "/billing/checkout" && request.method === "POST") {
    const auth = await jwtAuth();
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const planName = body?.planName || "starter";
    if (!env.STRIPE_SECRET_KEY) {
      return json(
        {
          error: "billing_not_configured",
          message: "Stripe integration is not configured on this server.",
        },
        { status: 501 }
      );
    }
    try {
      const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "subscription",
          "payment_method_types[]": "card",
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][product_data][name]": `FluxyChat ${planName.charAt(0).toUpperCase() + planName.slice(1)}`,
          "line_items[0][price_data][unit_amount]": planName === "starter" ? "1999" : "4999",
          "line_items[0][price_data][recurring][interval]": "month",
          "line_items[0][quantity]": "1",
          success_url: body?.successUrl || "https://app.fluxychat.com/billing?success=1",
          cancel_url: body?.cancelUrl || "https://app.fluxychat.com/billing?cancelled=1",
          client_reference_id: auth.projectId,
          "metadata[project_id]": auth.projectId,
          "metadata[plan_name]": planName,
          "subscription_data[metadata][project_id]": auth.projectId,
          "subscription_data[metadata][plan_name]": planName,
        }).toString(),
      });
      const session = await sessionRes.json();
      if (session.error) {
        logError("billing.stripe_checkout_error", session.error, requestLogCtx);
        return json({ error: "checkout_failed", detail: session.error.message }, { status: 502 });
      }
      await writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "billing.checkout_created",
        actorUserId: auth.userId,
        targetType: "plan",
        targetId: planName,
        metadata: { sessionId: session.id, planName },
      }).catch(() => {});
      return json({ url: session.url, sessionId: session.id });
    } catch (err) {
      logError("billing.stripe_checkout_exception", err, requestLogCtx);
      return json({ error: "checkout_failed" }, { status: 500 });
    }
  }

  if (url.pathname === "/billing/portal" && request.method === "POST") {
    const auth = await jwtAuth();
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const plan = await getProjectPlan(env, auth.projectId);
    if (!plan || !plan.billingStatus || plan.billingStatus === "manual") {
      return json({ error: "no_active_subscription" }, { status: 400 });
    }
    const body = await request.json().catch(() => null);
    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: "billing_not_configured" }, { status: 501 });
    }
    const customerId = await env.DB.prepare(
      "SELECT stripe_customer_id FROM project_plans WHERE project_id = ?"
    )
      .bind(auth.projectId)
      .first();
    if (!customerId?.stripe_customer_id) {
      return json({ error: "no_stripe_customer" }, { status: 400 });
    }
    try {
      const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: customerId.stripe_customer_id,
          return_url: body?.returnUrl || "https://app.fluxychat.com/billing",
        }).toString(),
      });
      const portalSession = await portalRes.json();
      if (portalSession.error) {
        return json({ error: "portal_failed", detail: portalSession.error.message }, { status: 502 });
      }
      return json({ url: portalSession.url });
    } catch (err) {
      logError("billing.stripe_portal_exception", err, requestLogCtx);
      return json({ error: "portal_failed" }, { status: 500 });
    }
  }

  return null;
}
