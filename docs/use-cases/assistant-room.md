# Use case: Assistant room (AI agent)

Goal: a room where an AI agent can be invoked (manually or via mentions), with run history and cost visibility.

## 1) Create an agent (admin JWT)

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

## 2) Create a dedicated room

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

## 3) Invoke the agent (REST)

```bash
export AGENT_ID="<agentId>"
export ROOM_ID="<roomId>"

curl -sS -X POST "$FLUXY_BASE_URL/agents/$AGENT_ID/invoke" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "'"$ROOM_ID"'",
    "content": "Write a 3-bullet summary of this thread"
  }'
```

## 4) Run history and cost insight

```bash
curl -sS "$FLUXY_BASE_URL/agents/$AGENT_ID/runs?limit=20" \
  -H "Authorization: Bearer $ADMIN_JWT"

curl -sS "$FLUXY_BASE_URL/stats/ai?minutes=60" \
  -H "Authorization: Bearer $ADMIN_JWT"
```
