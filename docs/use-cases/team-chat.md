# Use case: Team chat

Obiettivo: chat interna (team workspace) con rooms multiple, unread count e webhooks per integrazioni.

## 1) Rooms e membership

Creazione room con membri:

```bash
export FLUXY_BASE_URL="http://127.0.0.1:8787"
export FLUXY_API_KEY="fc_..."

curl -sS -X POST "$FLUXY_BASE_URL/rooms" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{
    "type": "group",
    "name": "team:engineering",
    "members": [
      { "userId": "alice", "role": "member" },
      { "userId": "bob", "role": "member" }
    ]
  }'
```

Lista rooms:

```bash
curl -sS "$FLUXY_BASE_URL/rooms" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY"
```

Unread count per room:

```bash
export ROOM_ID="<roomId>"
curl -sS "$FLUXY_BASE_URL/rooms/$ROOM_ID/unread?userId=alice" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY"
```

## 2) WebSocket connect (client-side)

Il WS e room-scoped e richiede token:

- URL: `/ws/room/:roomId?token=<JWT>`
- membership check enforced lato Worker/DO

Esempio concettuale:

```js
const ws = new WebSocket(`${baseUrl.replace("http", "ws")}/ws/room/${roomId}?token=${encodeURIComponent(jwt)}`);
ws.onmessage = (ev) => console.log(JSON.parse(ev.data));
```

## 3) Webhooks per integrazioni (server-side)

Registrazione webhook (admin JWT):

```bash
export ADMIN_JWT="<ADMIN_JWT>"

curl -sS -X POST "$FLUXY_BASE_URL/webhooks" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/fluxy/webhook",
    "secret": "whsec_...",
    "eventTypes": ["message.created","report.created"]
  }'
```

Note:

- Le delivery sono persistite in `webhook_deliveries` con retry/backoff.
- Admin inspection: `GET /admin/webhooks/deliveries`

