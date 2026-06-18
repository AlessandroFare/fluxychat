# Worker Splitting Plan

**Status:** P3 strategic — groundwork document, not an immediate action item.
**Last updated:** 2026-06-18

## Motivation

The current `apps/worker` is a single Cloudflare Worker with 100+ route modules, 887 lines in the entry point, and three Durable Object classes. This works well at current scale, but has growth risks:

1. **Bundle size** — Cloudflare Workers have a 10 MB compressed limit. Each new route (compliance, DLP, ediscovery, SOC2, HIPAA) adds to the bundle.
2. **Deploy surface** — A hotfix to compliance code requires redeploying the entire realtime messaging path.
3. **Isolation** — Compliance/DLP routes have stricter auth requirements but share the same process boundary as public room endpoints.
4. **Team ownership** — As the team grows, a monolithic worker makes code review and ownership boundaries harder.

## Proposed Split

### Phase 1: Extract a compliance/governance worker

Move audit, compliance, DLP, retention, and governance routes into a second Worker that shares the same D1 database.

**Routes to move (~20 modules):**

| Current file | Example routes |
|---|---|
| `audit-export-http.js` | `/audit/export/*` |
| `compliance-export-http.js` | `/compliance/export/*` |
| `dlp-integration-http.js` | `/dlp/*` |
| `ediscovery-http.js` | `/ediscovery/*` |
| `enterprise-compliance-http.js` | `/compliance/*` |
| `gdpr-http.js` | `/gdpr/*` |
| `hipaa-http.js` | `/hipaa/*` |
| `identity-access-http.js` | `/iam/*` |
| `ip-whitelist-http.js` | `/ip-whitelist/*` |
| `sso-http.js` | `/sso/*` |
| `soc2-http.js` | `/soc2/*` |
| `custom-retention-http.js` | `/retention/*` |
| `reports-webhooks-http.js` | `/webhooks/verify` |
| `incident-response-http.js` | `/incidents/*` |
| `watchlist-http.js` | `/watchlist/*` |
| `rate-limit-dashboard-http.js` | `/admin/rate-limits/*` |

**Shared resources (same D1, different Worker binding):**

- D1 database: `fluxychat` (same DB, read/write)
- KV namespace: `RATE_LIMIT_KV` (read-only for rate-limit dashboard)
- No Durable Objects needed (compliance is all REST, no WebSocket)

### Phase 2 (future): Separate the AI/agent path

Move agent-related routes into a dedicated AI Worker. This is natural since the `apps/ai-agent` already exists as a separate service.

| Routes to move |
|---|
| `agents-http.js`, `agent-profiles-http.js`, `agent-queue-http.js` |
| `ai-actions-http.js`, `ai-analytics-http.js`, `ai-image-http.js` |
| `ai-moderation-http.js`, `llm-http.js`, `multimodal-ai-http.js` |
| `messages-agents-http.js`, `suggest-replies-http.js` |
| `voice-messages-http.js`, `voice-translation-http.js` |
| `thread-summary-http.js`, `digest-http.js`, `room-memory-http.js` |

This could potentially merge with `apps/ai-agent` or remain a separate Worker that the AI agent service calls.

### Phase 3 (future): Split DO bindings

Currently all three DOs live in one Worker:
- `RoomDurableObject` — WebSocket rooms (core)
- `UserDurableObject` — per-user presence/inbox
- `IpRateLimiterDurableObject` — auth rate limiting

Long-term, the rate limiter could be a standalone DO Worker shared across both the main and compliance workers.

## Implementation Approach

### Shared code via workspace package

1. Extract shared auth/JWT utilities, response helpers, and D1 query builders into a new workspace package: `packages/worker-lib`
2. Both Workers import from this package (bundled by esbuild at deploy time)

### Routing strategy

```
api.fluxychat.com/*           → main worker (rooms, messages, presence, billing)
compliance.fluxychat.com/*   → compliance worker (audit, DLP, GDPR, HIPAA)
ai.fluxychat.com/*           → AI worker (future Phase 2)
```

Each Worker has its own `wrangler.toml` with:
- Same D1 binding (read/write)
- Custom domain routing via `routes` or `custom_domains`
- Independent deploy cadence

### Shared DO challenge

Durable Objects are bound to a single Worker. If both Workers need to interact with rooms:
- **Compliance Worker** reads/writes D1 directly (no DO needed)
- **Main Worker** handles all WebSocket/DO logic
- Cross-worker communication via D1 as the coordination layer (same approach used today by the AI agent service)

### Migration steps (Phase 1)

1. Create `packages/worker-lib` with shared utilities
2. Create `apps/compliance-worker` with `wrangler.toml` pointing at the same D1
3. Move route files + update imports
4. Add compliance custom domain route
5. Update dashboard API calls to point compliance routes at the new domain
6. Deploy compliance worker independently
7. Verify dashboard compliance features work
8. Remove moved routes from main worker, redeploy

### Risks

| Risk | Mitigation |
|------|-----------|
| D1 schema drift between workers | Single D1 migration source; both workers reference same `db/` directory |
| CORS origin mismatch | Both workers use the same `ALLOWED_ORIGINS` env var |
| Auth token compatibility | Both workers import the same JWT verification from `worker-lib` |
| Deploy coordination | Compliance worker has zero DO dependencies — can deploy independently |
| Bundle size regression | Splitting reduces the main worker bundle by ~15-20% |

## Bundle Size Estimate

| Worker | Est. modules | Est. compressed |
|--------|-------------|----------------|
| Current monolith | ~110 | ~3.5 MB |
| Main worker (post-split) | ~70 | ~2.5 MB |
| Compliance worker | ~20 | ~800 KB |
| AI worker (Phase 2) | ~20 | ~1 MB |

All well within the 10 MB limit, but the split provides headroom for 2-3x growth.

## Decision criteria

Proceed with Phase 1 when:
- Main worker bundle approaches 5 MB compressed
- Compliance feature velocity requires independent deploys
- Team grows to need clear ownership boundaries

No urgency today — the current monolith is manageable and the splitting cost (shared lib extraction, routing changes, two deploy pipelines) is non-trivial.
