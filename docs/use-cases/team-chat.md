# Use case: Team chat

Goal: internal team workspace chat with multiple rooms, unread counts, and webhooks for integrations.

## 1) Rooms and membership

Create a room with members:

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

List rooms:

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

The WebSocket is room-scoped and requires a token:

- URL: `/ws/room/:roomId?token=<JWT>`
- Membership is enforced in the Worker / Durable Object

Conceptual example:

```js
const ws = new WebSocket(`${baseUrl.replace("http", "ws")}/ws/room/${roomId}?token=${encodeURIComponent(jwt)}`);
ws.onmessage = (ev) => console.log(JSON.parse(ev.data));
```

## 3) Webhooks for integrations (server-side)

Register a webhook (admin JWT):

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

Notes:

- Deliveries are stored in `webhook_deliveries` with retry/backoff.
- Admin inspection: `GET /admin/webhooks/deliveries`
