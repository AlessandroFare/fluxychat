# Use case: Support chat

Goal: a support chat between end users and your support team, with moderation and export.

## Recommended flow

- Your app backend mints a JWT for the end user (`member` role)
- The dashboard / support tool uses an `admin` or `moderator` JWT
- The support room is a `group` (or `dm` for 1:1)

## 1) Mint JWT for the user (server-side)

```bash
export FLUXY_BASE_URL="http://127.0.0.1:8787"
export FLUXY_API_KEY="fc_..."

curl -sS -X POST "$FLUXY_BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{
    "userId": "customer_123",
    "roles": ["member"],
    "ttlSeconds": 3600
  }'
```

## 2) Create a support room (server-side)

```bash
curl -sS -X POST "$FLUXY_BASE_URL/rooms" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{
    "type": "group",
    "name": "support:customer_123",
    "members": [
      { "userId": "customer_123", "role": "member" },
      { "userId": "support_1", "role": "admin" }
    ]
  }'
```

## 3) Send messages (client/SDK or REST)

REST (requires JWT):

```bash
export FLUXY_JWT="<JWT>"
export ROOM_ID="<roomId>"

curl -sS -X POST "$FLUXY_BASE_URL/messages" \
  -H "Authorization: Bearer $FLUXY_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "'"$ROOM_ID"'",
    "content": "Hi, I need help"
  }'
```

## 4) Basic moderation (admin/moderator)

```bash
export ADMIN_JWT="<ADMIN_JWT>"

curl -sS -X POST "$FLUXY_BASE_URL/admin/mute" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "'"$ROOM_ID"'",
    "userId": "customer_123",
    "reason": "spam",
    "durationSeconds": 600
  }'
```

Audit trail:

```bash
curl -sS "$FLUXY_BASE_URL/admin/audit/events?limit=50&action=admin.mute" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

## 5) Export for audit/compliance

```bash
curl -sS "$FLUXY_BASE_URL/export/messages.json?roomId=$ROOM_ID" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" > messages.json
```
