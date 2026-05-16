# Cookbook: Auth / Token / JWT (role-based)

Fluxychat usa due forme di credenziali:

- **API key** (`X-Fluxy-Api-Key`): server-to-server, identifica il **tenant/project**.
- **JWT** (`Authorization: Bearer ...`): client-to-worker/SDK, contiene `sub` (userId), `tid` (projectId), `roles`, `exp`.

Regola pratica:

- **La tua app** conserva l’API key in backend e **minta i JWT** per i client (mai esporre l’API key nel browser).

## Variabili utili

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

Risposta:

- `token`: JWT
- `expiresIn`: secondi
- `claims`: echo dei claim principali

## 2) Ruoli: cosa sbloccano (quick map)

I ruoli vivono nel claim `roles` del JWT.

- **member**: operazioni chat base (send/edit/delete own message, read receipts, reactions)
- **moderator**: azioni admin/moderazione (es. mute/ban, webhook replay) dove consentito
- **admin**: tutte le admin ops standard (alerts rules, webhooks, projects…) salvo restrizioni
- **owner**: superset di `admin` (per operazioni “piu sensibili”)

Nota: diversi endpoint admin richiedono ruoli specifici. In generale:

- `/admin/alerts/rules`: **owner/admin**
- `/admin/projects*`: **owner/admin**
- `/admin/mute|ban|unmute|unban|announcement`: **owner/admin/moderator**
- `/admin/audit/events`: **owner/admin**

## 3) Esempi role-based

### 3.1 JWT per user “member”

```bash
curl -sS -X POST "$FLUXY_BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{ "userId": "customer_123", "roles": ["member"], "ttlSeconds": 3600 }'
```

### 3.2 JWT per “moderator”

```bash
curl -sS -X POST "$FLUXY_BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{ "userId": "mod_1", "roles": ["moderator"], "ttlSeconds": 3600 }'
```

### 3.3 JWT per “admin”

```bash
curl -sS -X POST "$FLUXY_BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{ "userId": "admin_1", "roles": ["admin"], "ttlSeconds": 3600 }'
```

## 4) Chiamate REST con JWT

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

Formato:

- `GET /ws/room/:roomId?token=<JWT>`
- membership check enforced

```js
const wsUrl = `${baseUrl.replace("http", "ws")}/ws/room/${roomId}?token=${encodeURIComponent(jwt)}`
const ws = new WebSocket(wsUrl)
```

## 6) Next.js snippet (Route Handler) per mintare JWT

Esempio concettuale: la tua app riceve una sessione utente, poi chiama Fluxychat `/auth/token` con la tua API key.

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

## 7) Failure modes comuni

- **401 invalid api key**: l’API key non risolve un project valido (o e revoked)
- **401 token expired**: `exp` passato, minta un JWT nuovo (ttl piu corto e rotation lato app)
- **403 forbidden**: ruolo nel token insufficiente per endpoint admin
- **403 WS**: user non membro della room (membership check)

