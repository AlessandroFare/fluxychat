# AI agent + human handoff (P12-H)

Intercom-Fin-style flow: an in-room AI agent responds until a human operator takes over. Handoff pauses AI invokes, enqueues an agent task with thread context, and resumes AI when the handoff is completed with a disposition code.

## API

| Method | Path | Role | Action |
|--------|------|------|--------|
| `GET` | `/rooms/{roomId}/handoff` | member+ | Current handoff state |
| `POST` | `/rooms/{roomId}/handoff` | moderator/admin/owner | Take over from AI |
| `PATCH` | `/rooms/{roomId}/handoff` | moderator/admin/owner | Complete with disposition |

Disposition codes: `GET /agent-queue/dispositions` (shared with agent queue wrap-up).

## Behaviour

1. **Take over** — builds a context summary from the last 12 messages, creates + auto-claims an agent queue task (`trigger_source=ai_handoff`), inserts `room_handoffs` row (`human_active`), broadcasts `type: handoff` on the room WebSocket.
2. **While active** — `POST /agents/:id/invoke` and `@mention` agent invokes return `409 human_handoff_active`.
3. **Complete** — `PATCH` with disposition resolves the handoff and linked agent task; AI can respond again.

## Dashboard

- **Agent room chat** — `<AgentHandoffBanner />` (Take over / Complete handoff + context preview).
- **Agent queue** — `/agent-queue` with disposition picker and resolved stats.

## SDK

```ts
const { handoff } = await client.getRoomHandoff(roomId);
await client.requestRoomHandoff(roomId, { agentId, note: "VIP customer" });
await client.resolveRoomHandoff(roomId, "resolved");
```

## Database

- Migration `0056_room_handoffs.sql`
- Links to `agent_tasks` via `agent_task_id`

## Related

- Agent queue (P13-T4) — `/agent-queue` SLA timers; dispositions (P13-T5) — `GET /agent-queue/dispositions`
- `ROADMAP_EXECUTION.md` § P12-H exit criteria
