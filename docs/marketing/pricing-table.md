# Pricing — canonical model

Two-track model: **self-serve** enforcement (Free / Starter / Pro) and
**sales-led** display (Growth / Business / Enterprise). The numbers below are
mirrored in `apps/worker/src/lib/plan-tier-limits.ts` and
`apps/dashboard/lib/plan-catalog.ts`. A CI cross-check
(`scripts/check-pricing-consistency.mjs`) fails the build if the two modules
drift.

---

## Self-serve plans (enforced)

These are the only tiers the billing system enforces. Prices are in **USD**.

| Plan | Price | Messages / month | Agent invokes / month | Webhook deliveries / month |
|------|-------|------------------|------------------------|-----------------------------|
| Free | $0/mo | 50,000 | 1,000 | 10,000 |
| Starter | $19.99/mo | 500,000 | 10,000 | 100,000 |
| Pro | $49.99/mo | 5,000,000 | 100,000 | 1,000,000 |

Included in every paid plan: signed webhooks with retries, GDPR export and
erasure endpoints, embeddable widget, dashboard access, and SDK access.

---

## Sales-led plans (display only)

These are quote-based. They appear on the landing page next to the self-serve
table; clicking them opens a `mailto:` to our sales team. They do **not** map
onto the billing system and they are **not** enforced — the worker always
normalizes the `plan_name` on `project_plans` to one of `free / starter / pro`.

| Plan | Price | For |
|------|-------|-----|
| Growth | From $199/mo | Small B2B SaaS with omnichannel inbox, AI memory, search, light moderation |
| Business | From $699/mo | Teams needing SSO, custom domain, audit export, priority support, white-label lite |
| Enterprise | Custom | Regulated / large deployments: SCIM, SLA, retention, DLP, compliance review, dedicated support |

When a customer signs a Growth / Business / Enterprise contract, the operator
manually grants a matching `pro` plan in the billing system (with custom
limits if needed) and configures SSO, custom domain, retention, and audit
exports out of band.

---

## Usage add-ons (overage)

- Messages above quota
- AI calls (LLM provider cost + 20% margin)
- Voice minutes
- Media storage
- Webhook deliveries
- Extra rooms / tenants

---

## Short FAQ

**Why usage-based?**  
Real cost scales with messages, AI, and media. Fixed plans cover the platform;
heavy usage is metered.

**What's the difference between Starter/Pro and Growth/Business?**  
Starter ($19.99) and Pro ($49.99) are self-serve with hard monthly caps you
can buy in a few clicks. Growth ($199) and Business ($699) are custom
contracts that include things we don't sell on the website: SSO add-on,
custom domain, audit export schedules, white-label lite, priority support.

**Enterprise vs Business?**  
Business is self-serve-style with high limits. Enterprise adds SCIM, SLA, DLP,
security review, and dedicated support.

**Self-host vs hosted?**  
Same worker and SDK. Hosted is faster to start; self-host gives full control
on Cloudflare.

**Where do these numbers come from?**  
The single source of truth is `CANONICAL_TIER_LIMITS` in
`apps/worker/src/lib/plan-tier-limits.ts` (mirrored in
`apps/dashboard/lib/plan-catalog.ts`). Drift between the two fails CI.
