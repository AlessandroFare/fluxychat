## Stripe billing runbook (M6-B)

This doc is the operational checklist to validate Stripe end-to-end for FluxyChat.

### What the Worker implements

- **Checkout**: `POST /billing/checkout` (JWT) creates a Stripe Checkout Session (subscription mode).
  - It passes `client_reference_id = <projectId>` and sets `metadata.project_id` / `metadata.plan_name`.
  - It also sets `subscription_data.metadata.project_id` / `subscription_data.metadata.plan_name` so subscription webhooks can resolve tenancy.
- **Portal**: `POST /billing/portal` (JWT) opens the customer portal for `project_plans.stripe_customer_id`.
- **Webhook**: `POST /webhooks/stripe` verifies `Stripe-Signature` when `STRIPE_WEBHOOK_SECRET` is configured, rejects replays (> 5 minutes), and updates `project_plans` on:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - duplicate Stripe event IDs are ignored idempotently (`stripe_webhook_events`)

### Required production configuration

Worker env vars:

- `STRIPE_SECRET_KEY` (server secret)
- `STRIPE_WEBHOOK_SECRET` (signing secret for `Stripe-Signature`)
- `QUOTAS_ENABLED=true` (recommended for predictable costs)
- `DEFAULT_PRICING_VERSION=v1` (or your chosen version)

Stripe dashboard setup:

- **Webhook endpoint**: point to `https://<worker-domain>/webhooks/stripe`
- Subscribe to (at minimum):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

### Smoke test (manual, 5–10 min)

Pre-req: you have an **admin JWT** for the project (Dashboard `Onboarding` can mint one).

1. **Load current plan**
   - Dashboard → `Billing` → `Load Plan & Usage`
   - Expect `billingStatus` is `manual` (or previous state).

2. **Start checkout**
   - Dashboard → `Billing` → Upgrade (Starter/Pro)
   - Complete checkout using Stripe test card `4242 4242 4242 4242`.

3. **Confirm webhook applied**
   - After redirect back to `/billing?success=1`, click **Refresh**
   - Expect:
     - `billingStatus: active`
     - `planName` updated to the chosen plan
     - `stripeCustomerId` and `stripeSubscriptionId` set in the backend row

4. **Change status via portal**
   - If portal is enabled (billingStatus active): `Manage Subscription`
   - Cancel subscription → confirm `customer.subscription.deleted` fires
   - Refresh Billing page → expect `planName: free`, `billingStatus: cancelled`

### Production exit criteria (M6-B)

Mark this section complete only after one pass on **Stripe live** (or test mode with webhooks pointed at the real deployed worker):

- [ ] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set on the Worker; Stripe dashboard endpoint `https://<worker>/webhooks/stripe` registered with the minimum events listed above.
- [ ] Test checkout (card `4242…`) → `success` redirect → refresh Billing → `billingStatus: active`, consistent `planName`, `stripeCustomerId` / `stripeSubscriptionId` populated.
- [ ] In Stripe **Developers → Webhooks → events**: at least one `checkout.session.completed` delivered with `200` and no error loop.
- [ ] Portal “Manage subscription” → change or cancel → `customer.subscription.updated` or `deleted` → plan state updated in D1 after refresh.
- [ ] Manual replay of the same `event id` (or Stripe retry) does not corrupt the plan (`stripe_webhook_events` idempotency).

### Troubleshooting

- **Webhook 401 invalid signature**:
  - Check `STRIPE_WEBHOOK_SECRET` matches the endpoint signing secret in Stripe dashboard.
  - Ensure Cloudflare does not transform the body (Worker uses `request.text()` for raw payload).
- **Plan not updated after checkout**:
  - Verify Stripe webhook event deliveries for `checkout.session.completed`.
  - Confirm the checkout session contains `client_reference_id` (project id) and `metadata.plan_name`.
- **Subscription events can't resolve project id**:
  - Ensure checkout includes `subscription_data.metadata.project_id` and `subscription_data.metadata.plan_name`.
  - Ensure `project_plans.stripe_customer_id`/`stripe_subscription_id` is being persisted.
