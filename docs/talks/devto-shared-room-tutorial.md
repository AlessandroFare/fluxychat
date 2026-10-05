# DEV.to draft — shared AI room (not published)

Hacktoberfest 2026 is MLH / DEV events. It is **not** “label issues `hacktoberfest` and farm PRs.” Do not add that label.

This is a follow-on to the existing socket-fleet article. Do not post until a human pastes it.

## Title

A shared room for humans and an agent on one Cloudflare Durable Object

## Outline

1. One DO, one WebSocket for chat. Yjs is a second binary socket on the same route. `invokeAgent` writes the same timeline.
2. Scaffold: `npx @fluxy-chat/create-fluxy-chat@latest my-room --example shared-ai-room`
3. Public rooms: `pk_` in the browser. Private rooms: mint JWT with `fc_` on the server.
4. HITL: two-key default in a shared room. Maker-checker: requester and agent cannot approve.
5. What this is not: not an SFU, not a HIPAA product, not Speakeasy-generated SDKs, not a CLM.

Pin `@fluxy-chat/sdk` from `npm view`. Hosted is beta. Self-host is MIT.

**Status:** draft. Not published.
