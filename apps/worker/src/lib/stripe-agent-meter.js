/**
 * Optional Stripe Billing Meter for *this* tenant (project_plans.stripe_customer_id).
 * Not metering of the tenant's end users. Opt-in: STRIPE_AGENT_METER_EVENT_NAME.
 */
export async function reportStripeAgentTokenMeter(env, { projectId, tokens, identifier }) {
  const secret = String(env?.STRIPE_SECRET_KEY || "").trim();
  const eventName = String(env?.STRIPE_AGENT_METER_EVENT_NAME || "").trim();
  if (!secret || !eventName) return { skipped: true, reason: "not_configured" };
  const value = Math.max(0, Math.floor(Number(tokens) || 0));
  if (!value) return { skipped: true, reason: "zero_tokens" };
  if (!projectId) return { skipped: true, reason: "no_project" };

  const row = await env.DB.prepare(
    `SELECT stripe_customer_id FROM project_plans WHERE project_id = ? LIMIT 1`,
  )
    .bind(projectId)
    .first()
    .catch(() => null);
  const customer = String(row?.stripe_customer_id || "").trim();
  if (!customer.startsWith("cus_")) return { skipped: true, reason: "no_customer" };

  const body = new URLSearchParams();
  body.set("event_name", eventName);
  body.set("payload[stripe_customer_id]", customer);
  body.set("payload[value]", String(value));
  if (identifier) body.set("identifier", String(identifier).slice(0, 100));

  const fetchImpl = env.fetchImpl || fetch;
  const res = await fetchImpl("https://api.stripe.com/v1/billing/meter_events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return { skipped: false, ok: res.ok, status: res.status };
}
