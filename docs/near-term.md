# Near-term (public)

What to build next. No third-party writeup names. Hosted is beta. No traction claims.

## Now

1. Guest first: `pk_` + `joinPublicRoomAsGuest` / `--example shared-ai-room`. Console signup is ops, not the first click.
2. Hosted 60s clip: two humans, one agent, refresh, tool approval (`deal-room` capture). Record it; do not invent views.
3. Cloudflare Agent → room: helper + [guide](/docs/guides/cloudflare-agents-room). Generation off the Room DO (`AgentDurableObject` `room_invoke`).
4. Activation: `GET /stats/launch-kpis` `activeProject` = ≥100 messages in 7 days (`ACTIVE_PROJECT_MESSAGES_7D`). Funnel checks: API key, room, first message, first invoke. `POST /public/activation-ping` `{ event: cli_launched | first_message | first_agent_invoke }` (no PII).
5. Staging soak: idle sockets vs Durable Object duration on the Cloudflare invoice. Publish the number only from that invoice.
6. Design partners / case study — real names only.

## Later

Python/Go SDKs (stub under `packages/python` with `join_ag_ui`), published mobile packages, Pusher/Ably/Stream/PartyKit codemods, RAG connectors, usage billing beyond existing quotas, EU DO jurisdiction in wrangler for self-host. Agent-run inspector: pick a room on Agents → Observability.

## Not now

SOC 2 / HIPAA badges, production SFU/SIP, Think fiber resume **in the Room DO**, Game/IoT in the hero, posting to Dev.to/HN from this repo.
