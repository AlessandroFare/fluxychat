# FluxyChat audit remediation (closed items)

Source: [production-due-diligence-2026-06-15.md](./production-due-diligence-2026-06-15.md)

**Status on this page:** `done` work only. Remaining items are tracked outside the public tree (`docs/audit/REMEDIATION.open.md`, gitignored).

**Status legend:** `done` | `deferred` (engineering debt, not an exploit writeup)

---

## Closed (P0 / quick wins)

| ID | Summary | Notes |
|----|---------|--------|
| S-1 | `/api/fluxy/mint-member` body API key | No body key; tenant Clerk key only |
| S-4 | Search snippet XSS | `highlightSearchSnippet()` |
| S-5 | `renderMarkdown` XSS | Escape + placeholders |
| S-6 | Guest `userId` impersonation | Server-generated guest IDs |
| S-7 | Dashboard unauthenticated when Clerk off | Ack gate in production |
| S-8 | Stripe webhook without secret | 503 if secret missing |
| S-9 | Identity CORS `*` | Allowlist |
| S-15 | Outbound URL checks | `apps/worker/src/lib/url-ssrf.ts` (hostname/IP/redirect). Residual DNS cases are private-tracker only. |
| QW-1 | Default `ALLOWED_ORIGINS` | Hosted not `*` |
| QW-3 | Stripe webhook secret required | |
| QW-4 | Identity CORS allowlist | |
| QW-5 | Drop `projectApiKey` from mint-member | |
| QW-6 | Guest userId server-generated | |
| QW-7 | PATCH message `deleted_at IS NULL` | |
| QW-8 | Escape search snippets | |
| QW-11 | Sanitize markdown + snippets | |

SAML **login on hosted** is disabled unless `SAML_SSO_ENABLED=true`. Self-host is unchanged.

## Deferred (non-exploit)

| ID | Summary |
|----|---------|
| S-11 | API key hash upgrade |
| P-1 | Router consolidation |

## Changelog

| Date | Change |
|------|--------|
| 2026-06-15 | Tracker created; first P0 batch |
| 2026-09-28 | Public file lists closed work only |
