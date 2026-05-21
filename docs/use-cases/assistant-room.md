# Use case: Assistant room (AI agent)

Goal: a room where an AI agent can be invoked (manually or via mentions), with run history and cost visibility.

## Console (open beta UX)

- Default room id: `assistant:general` (created from Quickstart or **Agents → Chat in room**).
- Built-in agents (`@assistant`, `@onboarding`, etc.) are seeded when a project is created on the Worker.
- **Agents** page: unified **agent profile** (identity, model from Worker registry, instructions, hooks) + **LLM keys** overview per provider.
- Select an agent → **Chat in room** for live WebSocket chat (requires member JWT). Run banner shows `runId`, latency, tokens; **tool_call / tool_result / tool_error** cards appear **in the message thread** when `toolExecuteUrl` is configured (WebSocket + run poll).
- **Agent profile** → starter **templates** (assistant, support, onboarding, summarizer, moderator) prefill system prompt and handle.
- **Reply-to**: hover a message → **Reply**; sends with `parent_id` (mention invoke and REST invoke both pass `replyTo`).
- **Fallback model**: optional second provider/model in agent profile (`config.llm.fallbackProvider`) when the primary fails on the first attempt.
- **Rooms** page: **Assistant room** panel opens `assistant:general` with embedded chat.
- Agents with a **handle** (e.g. `@assistant`): send `@assistant your question` — the Worker invokes in the background and **streams** token edits over WebSocket (`streaming: true` on message rows).
- Agents without a handle: REST invoke after send (same stream on the Worker when the provider supports it).

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
