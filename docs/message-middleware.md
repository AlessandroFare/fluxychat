# Message middleware (inbound pipeline)

FluxyChat runs every inbound chat message through a shared pipeline **before** it is stored or broadcast (WebSocket `type: "message"` and `POST /messages`).

## Stages

1. **Validate** — non-empty string, max 4000 chars (`validateMessageContent`).
2. **Filter** — optional block when `MESSAGE_MIDDLEWARE_BLOCK_ON_MATCH=true` and content matches `BUILTIN_MODERATION_BLOCKED_SUBSTRINGS` (comma-separated, case-insensitive).
3. **Enrich** — optional metadata tag when `MESSAGE_MIDDLEWARE_ENRICH_TAG` is set (exposed on the broadcast payload as `middleware`).

Rejected messages return:

- WebSocket: `{ type: "error", message: "content_blocked: …" }` or `invalid_content: …`
- REST: `403` / `400` with `{ error, code }`

## Environment

| Variable | Default | Effect |
|----------|---------|--------|
| `MESSAGE_MIDDLEWARE_BLOCK_ON_MATCH` | off | Block send on substring match (not only post-hoc auto-flag) |
| `BUILTIN_MODERATION_BLOCKED_SUBSTRINGS` | — | Shared with post-message moderation scan |
| `MESSAGE_MIDDLEWARE_ENRICH_TAG` | — | Adds `middleware.enrichTag` on outbound WS payload |

## Implementation

- `apps/worker/src/lib/message-middleware.js` — `runInboundMessageMiddleware`
- Wired in `room-do.js` and `routes/messages-http.js`

Post-persist moderation (auto-flag to `moderation_events`) remains in `post-message-automations.js` when block-on-match is **off**.

