# Use case: Assistant room (AI agent)

Obiettivo: una room dove un AI agent puo essere invocato (manuale o via mention flow), con run history e cost visibility.

## 1) Creare un agent (admin JWT)

```bash
export FLUXY_BASE_URL="http://127.0.0.1:8787"
export ADMIN_JWT="<ADMIN_JWT>"

curl -sS -X POST "$FLUXY_BASE_URL/agents" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Assistant",
    "handle": "assistant",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "capabilities": ["chat"]
  }'
```

## 2) Creare una room dedicata

```bash
export FLUXY_API_KEY="fc_..."

curl -sS -X POST "$FLUXY_BASE_URL/rooms" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $FLUXY_API_KEY" \
  -d '{
    "type": "group",
    "name": "assistant:general",
    "members": [
      { "userId": "alice", "role": "member" }
    ]
  }'
```

## 3) Invocare l’agent (REST)

```bash
export AGENT_ID="<agentId>"
export ROOM_ID="<roomId>"

curl -sS -X POST "$FLUXY_BASE_URL/agents/$AGENT_ID/invoke" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "'"$ROOM_ID"'",
    "content": "Scrivi un riepilogo in 3 bullet di questo thread"
  }'
```

## 4) Run history e cost insight

```bash
curl -sS "$FLUXY_BASE_URL/agents/$AGENT_ID/runs?limit=20" \
  -H "Authorization: Bearer $ADMIN_JWT"

curl -sS "$FLUXY_BASE_URL/stats/ai?minutes=60" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

