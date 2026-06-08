# Sendbird Desk vs FluxyChat admin (P10-SB9)

**Sendbird Desk** is a separate operator product: ticket queues, agent assignment, SLA timers, canned replies, and customer profile sidebar. FluxyChat does **not** ship Desk parity in P10.

## What FluxyChat provides instead

| Desk capability | FluxyChat equivalent |
|-----------------|---------------------|
| Agent inbox | Dashboard **admin** room + `RealtimeEventInspector` |
| Customer context | Room members, message history, compliance export |
| Assignment / queues | Use **room types** (`dm`, `group`, `public`) + roles (`moderator`, `admin`) |
| Offline reach | Sent.dm SMS/WhatsApp + in-app notifications |
| Moderation | Reports, blocks, terminate socket, pin, polls |

## Integration path

1. Embed FluxyChat in your CRM/helpdesk UI via SDK + JWT (`POST /auth/token`).
2. Route high-priority public rooms to moderator roles.
3. For full Desk workflows, pair FluxyChat realtime with your existing ticketing system (webhooks: `message.created`, `member_joined`).

## Out of scope (document only)

- Multi-queue routing rules
- Agent skill-based assignment
- Desk-native SLA dashboards

See `docs/competitive-parity-p10.md` for the full Sendbird matrix.
