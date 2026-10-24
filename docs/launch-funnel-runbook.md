# Launch funnel runbook

How to read the activation numbers for hosted beta. One screen, no guessing.

## The weekly read

1. Dashboard → **Analytics & costs** → the **Launch KPIs** cards render as soon as a session is loaded; no room selection needed (room cards still wait for a room).
2. Or by API:

```sh
curl -s -H "Authorization: Bearer <admin or owner JWT>" \
  https://api.fluxychat.com/stats/launch-kpis
```

## What the numbers mean

| Field | Meaning |
| --- | --- |
| `activation.checks` | Six onboarding steps: project, active API key, JWT secret, first room, first message, first agent invoke |
| `activation.activationRate` | Completed steps / 6 for the selected project |
| `activation.activeProject` | `true` when the project sent ≥ `ACTIVE_PROJECT_MESSAGES_7D` messages in the last 7 days (default 100) |
| `retention.activeDaysLast7` / `trend` | Distinct active days this week vs the prior week |
| `conversion.monthlyMessages` | Messages this calendar month vs `FREE_MESSAGES_QUOTA_PER_MONTH` (default 200 000) |
| `conversion.convertedToPaid` | `true` only when monthly messages exceed the free quota. Free-tier usage is not a conversion, regardless of estimated revenue |

Env knobs: `ACTIVE_PROJECT_MESSAGES_7D`, `FREE_MESSAGES_QUOTA_PER_MONTH`.

## The CLI ping

`POST /public/activation-ping` accepts `{ "event": "cli_launched" | "first_message" | "first_agent_invoke" }` (no PII, IP rate-limited). Today only `cli_launched` is sent — by `create-fluxy-chat` when a project is scaffolded. The server-side checks above already derive first message / first invoke from D1 for hosted projects; the two remaining ping events would only add signal for self-host users and are intentionally not wired yet.

Pings land in Workers Logs (`activation.ping`). Read them with `wrangler tail` or Logpush when enabled.

## Guest → account

The guest-first path is part of the funnel, not a side door. `POST /tokens/link-guest` (SDK: `client.linkGuestAccount(guestToken)`) moves a guest's room memberships onto a real account; a second claim answers `409 guest_already_linked` with the account that won. Message authorship stays under the guest id — a link never rewrites history, so message counts do not move on a link.

There is no KPI card for links yet: read the `guest_links` table in D1 (`project_id`, `guest_user_id`, `target_user_id`, `linked_at`). A guest that links was in a room before signing up — treat it as a stronger signal than a bare signup. The guide is [Guest to account](/docs/guides/guest-to-account).

## What this does not measure

Signups (Clerk), docs traffic, npm downloads. Those come from their own dashboards.

## What is deployed

`wrangler deployments list` for the Worker; npm page for SDK versions. The funnel only reflects what is actually deployed, not the local tree.
