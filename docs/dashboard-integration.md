# Dashboard integration (JWT session & operator UI)

The Next.js app in `apps/dashboard` is a **developer / operator console** and live chat demo. This page summarizes how it authenticates and which Worker features it exercises.

## Session storage (security)

- State is persisted under **`fluxychat.dashboard.session.v1`** in **`sessionStorage`** (cleared when the browser tab closes).
- Fields: **`adminJwt`**, **`memberJwt`**, **`activeProject`** (id, name, optional `apiKey`, plan snapshot).
- One-time migration from legacy `localStorage` is performed on first load.

Use **Onboarding** or **Projects** to mint or paste tokens. The SDK client on the home page prefers **`memberJwt`**, then **`adminJwt`**, for `Authorization` on REST and WebSocket.

## Operator pages

| Path | Purpose | Typical token |
|------|---------|----------------|
| `/` | Live `useChat` demo + `ChatWindow` | Member or admin JWT |
| `/onboarding` | End-to-end: project, keys, room, message, agent | Starts with admin |
| `/projects` | Projects, API keys, plan | Admin JWT |
| `/rooms` | List/create/rename/delete rooms; members | Admin JWT for mutations |
| `/agents` | CRUD agents, invoke, runs | JWT with appropriate roles |
| `/admin` | Webhooks list, PATCH/DELETE, automation, audit snippets | Admin / owner |
| `/billing` | Plan, Stripe checkout/portal when configured | Admin |
| `/analytics` | Costs, SLO, launch KPIs | Admin |
| `/search` | Message search | JWT |
| `/privacy` | Policy copy + **GDPR export download** + **erasure request** | Export: member or admin; erasure: **owner/admin** JWT |

## GDPR API (Worker)

- **`GET /gdpr/export`** — Right of access / portability. Returns JSON attachment for the **`sub`** in the JWT.
- **`DELETE /gdpr/delete`** — Erasure for the **`sub`** in the JWT within the project; requires **`owner`** or **`admin`** roles. Redacts messages and removes related rows per Worker implementation.

The Privacy page calls these endpoints using the stored session tokens.

## SDK transport behavior (`useChat`)

Relevant to the home demo:

- **Send message**: REST when the client has a JWT; otherwise WebSocket payload.
- **Edit / delete message**: REST when authenticated; on failure, **WebSocket fallback** for the same operation.
- **Reconnect**: exponential backoff; after repeated failures the hook falls back to **SSE** (`GET /rooms/:id/stream` via `connectSSE`), then **REST polling** if SSE is unavailable.
- **`connectionStatus`**: `connected` | `connecting` | `reconnecting` | `disconnected` | `sse` | `polling`.

## File uploads & composed attachments

- Worker endpoint **`POST /upload`** (JWT) stores bytes in **R2** when `ATTACHMENTS` is bound; response returns a public **`/attachments/...`** URL.
- The home **`ChatWindow`** passes **`uploadComposerFile` → `FluxyChatClient.uploadFile(roomId, file)`** so image / file / audio icons use a native picker instead of URL prompts.
- **`POST /messages`** accepts an optional **`attachments`** array (same shape as websocket sends); entries are validated to `http(s)` URLs and persisted to D1 for history.

## Composer `@mentions`

The home page wires `@fluxychat/ui` **`ChatWindow`** with:

- **`mentionSuggestions`** — built by loading **`client.listAgents()`** and passing `{ handle, label, agentId }` per bot (handle falls back to a slug derived from name).
- **`typingAgentId`** — from **`useChat().typingAgentId`**, which merges websocket **`agentTyping`** events (includes `agentId`) with an in-flight id while **`invokeAgent`** runs.

`ChatWindow` merges those rows with **`onlineUsers`** IDs and **`@handles`** parsed from recent message text so the dropdown stays useful outside the Agents list alone. Matching is prefix on handle or substring on display **label**.

## Worker automation hooks (optional)

Configure on the Worker (see `apps/worker/wrangler.toml` comments):

| Env prefix | Behaviour |
|------------|-----------|
| **`AUTO_ROOM_SUMMARY_*`** | After new messages (REST, WS, bot, agent paths), enqueue an automatic **`room_summary`** when AI is configured and thresholds/cooldowns pass. Webhook **`room.summary`** fires when summaries are persisted. |
| **`BUILTIN_MODERATION_*`** | Substring blocklist match → moderation row (**`auto_flag`**), **`automation_events`**, webhook **`moderation.auto_flag`**; surfaced alongside user reports under admin reports filters. |

## Environment

- **`NEXT_PUBLIC_FLUXYCHAT_WORKER_URL`** — Worker base URL (default `http://127.0.0.1:8787` in dev).

See also: [Auth cookbook](./cookbook/auth-jwt.md), [Troubleshooting](./troubleshooting.md).
