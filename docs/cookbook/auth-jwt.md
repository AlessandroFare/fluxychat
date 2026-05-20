# Cookbook: Auth / Token / JWT (role-based)

Fluxychat uses two credential forms:

- **API key** (`X-Fluxy-Api-Key`): server-to-server, identifies the **tenant/project**.
- **JWT** (`Authorization: Bearer ...`): client-to-worker/SDK, contains `sub` (userId), `tid` (projectId), `roles`, `exp`.

Practical rule:

- **Your app** keeps the API key on the backend and **mints JWTs** for clients (never expose the API key in the browser).

## Useful variables

```bash
export FLUXY_BASE_URL="http://127.0.0.1:8787"
export FLUXY_API_KEY="fc_..."
```

## 1) Mint JWT (server-side)

Endpoint: `POST /auth/token`

```bash
curl -sS -X POST "$FLUXY_BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{
    "userId": "alice",
    "roles": ["member"],
    "ttlSeconds": 3600
  }'
```

Response:

- `token`: JWT
- `expiresIn`: seconds
- `claims`: echo of main claims

## 2) Roles: what they unlock (quick map)

Roles live in the JWT `roles` claim.

- **member**: basic chat (send/edit/delete own message, read receipts, reactions)
- **moderator**: admin/moderation actions (e.g. mute/ban, webhook replay) where allowed
- **admin**: standard admin ops (alert rules, webhooks, projects…) unless restricted
- **owner**: superset of `admin` (for more sensitive operations)

Note: different admin endpoints require specific roles. In general:

- `/admin/alerts/rules`: **owner/admin**
- `/admin/projects*`: **owner/admin**
- `/admin/mute|ban|unmute|unban|announcement`: **owner/admin/moderator**
- `/admin/audit/events`: **owner/admin**

## 3) Role-based examples

### 3.1 JWT for a `member` user

```bash
curl -sS -X POST "$FLUXY_BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{ "userId": "customer_123", "roles": ["member"], "ttlSeconds": 3600 }'
```

### 3.2 JWT for `moderator`

```bash
curl -sS -X POST "$FLUXY_BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{ "userId": "mod_1", "roles": ["moderator"], "ttlSeconds": 3600 }'
```

### 3.3 JWT for `admin`

```bash
curl -sS -X POST "$FLUXY_BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{ "userId": "admin_1", "roles": ["admin"], "ttlSeconds": 3600 }'
```

## 4) REST calls with JWT

### Send message

```bash
export JWT="<JWT>"
export ROOM_ID="<roomId>"

curl -sS -X POST "$FLUXY_BASE_URL/messages" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{ "roomId": "'"$ROOM_ID"'", "content": "hello" }'
```

### Admin mute (moderator/admin/owner)

```bash
export ADMIN_JWT="<ADMIN_JWT>"

curl -sS -X POST "$FLUXY_BASE_URL/admin/mute" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "roomId": "'"$ROOM_ID"'", "userId": "customer_123", "reason": "spam", "durationSeconds": 600 }'
```

## 5) WebSocket auth (client-side)

Format:

- `GET /ws/room/:roomId?token=<JWT>`
- membership check enforced

```js
const wsUrl = `${baseUrl.replace("http", "ws")}/ws/room/${roomId}?token=${encodeURIComponent(jwt)}`
const ws = new WebSocket(wsUrl)
```

## 6) Next.js snippet (Route Handler) to mint JWT

Conceptual example: your app receives a user session, then calls Fluxychat `/auth/token` with your API key.

```ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const res = await fetch(`${process.env.FLUXY_BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Api-Key": process.env.FLUXY_API_KEY!,
    },
    body: JSON.stringify({ userId, roles: ["member"], ttlSeconds: 3600 }),
  });

  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
```

## 7) Common failure modes

- **401 invalid api key**: API key does not resolve a valid project (or is revoked)
- **401 token expired**: `exp` passed — mint a new JWT (shorter TTL and rotation in your app)
- **403 forbidden**: token role insufficient for admin endpoint
- **403 WS**: user is not a room member (membership check)
