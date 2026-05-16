# Billing overage policy (v1)

This document defines the default overage behavior for FluxyChat plans in the current runtime model.

## Current enforcement model

- Quotas are enforced monthly by `project_usage_monthly`.
- When a project exceeds its quota for a metered metric, the API returns:
  - HTTP **`402`**
  - error code **`quota_exceeded`**
  - metadata: `metric`, `limit`, `used`, `month`

Affected runtime paths include:

- `messages_created` (HTTP + websocket message write paths)
- `agent_invokes`
- `webhook_deliveries` queue enqueue

## v1 overage behavior

- **Free plan**: hard stop at quota (`402 quota_exceeded`), no automatic overage.
- **Starter / Pro (default runtime today)**: hard stop at quota unless plan limits are manually adjusted in `project_plans`.
- **Enterprise-ready**: negotiated/custom limits via admin plan update API.

## Operator actions when quota is exceeded

1. Open Dashboard `Billing` and inspect monthly usage by metric.
2. Upgrade plan (Stripe checkout) or adjust plan limits through admin operations.
3. Retry workload after plan update; monitor `/stats/costs` and `/stats/slo`.

## Commercial notes

- This policy is intentionally conservative to keep infra cost predictable.
- Automatic pay-as-you-go overage billing is out of scope for v1 and can be introduced as a future pricing mode.

