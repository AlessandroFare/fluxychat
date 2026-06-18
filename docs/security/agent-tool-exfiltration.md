# Agent runtime: `tool_execute_url` and data exfiltration (ENG-17)

Fluxychat agents can call tenant-configured HTTP endpoints during a run:

- `context_fetch_url` — read-only context for the model
- `tool_execute_url` — executes tool calls the model selects

Both URLs are chosen by the **project admin** who owns the agent. SSRF to private networks is blocked (`assertSafeOutboundUrl` in `apps/worker/src/lib/url-ssrf.ts` and `agent-tools.js`).

## Insider threat (by design)

A tenant admin can:

1. Set `tool_execute_url` to a server they control.
2. Craft a `system_prompt` that instructs the model to send room content, user metadata, or tool arguments to that server.

This is intentional: agents integrate with the tenant's own systems. Fluxychat does not inspect or censor admin-authored prompts across tenants.

## What we do mitigate

| Risk | Mitigation |
|------|------------|
| SSRF to `127.0.0.1`, RFC1918, metadata IPs | Blocked before `fetch` |
| Runaway cost | Per-agent `rate_limit_rpm`, project `agent_invokes` quota |
| Cross-tenant access | JWT + project scope on agent CRUD and invoke paths |

## Operator guidance

- Document in your security FAQ that **tenant admins are trusted** for agent configuration.
- For enterprise deals, offer review of agent configs or restrict agent admin roles.
- Optional future: prompt lint endpoint or allow-list domains per project (not implemented today).

## Related code

- `apps/worker/src/lib/agent-runtime.js` — mention invoke, tool dispatch
- `apps/worker/src/lib/agent-tools.js` — POST to `tool_execute_url`
- `apps/worker/src/lib/url-ssrf.ts` — outbound URL policy

