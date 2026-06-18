# FluxyChat  Audit remediation tracker

Source audit: [production-due-diligence-2026-06-15.md](./production-due-diligence-2026-06-15.md)  
Overall score at audit: **47 / 100**  
Target: close **P0 + quick wins** before open beta scale-up; schedule **4–8 week** debt programme for router/TS/observability.

**Status legend:** `open` | `in_progress` | `done` | `wontfix` | `deferred`

---

## P0  block production (section 14)

| ID | Summary | Status | Notes / PR |
|----|---------|--------|------------|
| S-1 | `/api/fluxy/mint-member` body API key + console fallback | done | No body key; tenant Clerk key only; self-host `/admin/member-token` |
| S-2 | `canBypassRoomMembership` role bypass | open | Restrict bot bypass; audit log |
| S-3 | Public room access for any member | open | Policy review |
| S-4 | Search snippet XSS (`dangerouslySetInnerHTML`) | done | `highlightSearchSnippet()` |
| S-5 | `renderMarkdown` XSS | done | Escape + table/blockquote placeholders |
| S-6 | Guest session client `userId` impersonation | done | Server-generated guest IDs only |
| S-8 | Stripe webhook without secret | done | 503 if secret missing |
| S-9 | Identity routes CORS `*` | done | Uses handler `corsHeaders` / allowlist |
| S-7 | Dashboard no auth when Clerk off | done | Ack gate forced in production |
| S-11 | SHA-256 API key hash | deferred | Argon2/bcrypt migration |
| S-25 / S-28 | Plaintext webhook secrets / api_keys.secret | open | Fail-closed + column deprecation |
| FTS | `messages_fts.rowid` join bug | open | Functional  fix content table |
| P-1 | 100+ sequential dispatchers | deferred | Hono / static router |
| S-15 | SSRF string-only check | open | DNS resolution |

---

## Quick wins (section 15)

| ID | Summary | Status |
|----|---------|--------|
| QW-1 | Default `ALLOWED_ORIGINS` not `*` on hosted | done |
| QW-2 | Webhook secret encryption fail-closed | open |
| QW-3 | Stripe webhook secret required | done |
| QW-4 | Identity CORS from allowlist | done |
| QW-5 | Drop `projectApiKey` from mint-member | done |
| QW-6 | Guest userId server-generated | done |
| QW-7 | PATCH message requires `deleted_at IS NULL` | done |
| QW-8 | Escape search snippets | done |
| QW-9 | Log `canBypassRoomMembership` | open |
| QW-10 | `pnpm audit` in CI | open |
| QW-11 | Sanitize markdown + snippets | done |
| QW-12 | Fix FTS5 content table | open |
| QW-13 | Batch D1 writes in transactions | open |
| QW-14 | Structured trace sampling | open |
| QW-15 | Remove dynamic `import()` in hot paths | open |

---

## Security  HIGH (section 4)

| ID | Summary | Status |
|----|---------|--------|
| S-14 | Self-host DEFAULT_PROJECT_ID fallback | open |
| S-15 | SSRF DNS bypass | open |
| S-16–S-17 | WS room id vs DO id mismatch | open |
| S-18–S-19 | Rate limit read-modify-write | open |
| S-20 | WS rate limit lost on DO eviction | open |
| S-21 | SAML signature verification | open |
| S-22 | `presenceInfo` unauthenticated | open |
| S-23 | `/api/fluxy/*` no auth without Clerk | in_progress |
| S-24 | PII in logs | open |
| S-26 | Voice/stub routes exposed | open |
| S-27 | Mint project vs Clerk metadata | in_progress |

---

## Code quality (section 5)

| ID | Summary | Status |
|----|---------|--------|
| Q-1–Q-20 | Router, TS migration, room-do size, stubs | deferred |

---

## Performance (section 6)

| ID | Summary | Status |
|----|---------|--------|
| P-1–P-13 | Dispatcher, D1 on connect, webhooks, metrics | deferred |

---

## Database (section 7)

| ID | Summary | Status |
|----|---------|--------|
| FTS rowid | Search broken | open |
| FK gaps | No FK on project_id | deferred |
| Indexes | Hot path composites | open |

---

## Infra / DevOps (section 8)

| ID | Summary | Status |
|----|---------|--------|
| CI SAST/SBOM | No Semgrep/SBOM in CI | open |
| Staging before prod | Manual deploy | open |
| Alerting | No PagerDuty/Slack wired | open |
| PR preview env | Missing | deferred |

---

## Testing (section 10)

| ID | Summary | Status |
|----|---------|--------|
| mint-member bypass | No test | in_progress |
| SAML / guest / search XSS | No test | in_progress |
| Dashboard unit coverage | Sparse | deferred |

---

## Bugs non-security (section 13)

| ID | Summary | Status |
|----|---------|--------|
| B-1–B-15 | Stream ops, orphans, idempotency | open |

---

## Long-term (section 16)

Tracked as epics  not scheduled in this pass:

- Hono router + kill deps bag
- Full worker TS migration
- httpOnly session cookies
- Cloudflare Analytics Engine for counters
- Third-party pentest before GA

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-15 | Audit imported; remediation tracker created |
| 2026-06-15 | P0 batch 1: mint-member, guest ID, Stripe, CORS, XSS, PATCH deleted_at, prod ack gate |
