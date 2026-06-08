# Supergroup / large-room DO sharding (P10-SB8)

FluxyChat uses one **Room Durable Object** per logical `roomId` by default. That matches most tenant channels (tens–hundreds of concurrent sockets). Sendbird **supergroups** (100k+ members) need **fan-out sharding** when a single DO approaches Cloudflare’s ~500–1k req/s ceiling.

## Model

| Concept | Value |
|---------|--------|
| Logical room | `roomId` in D1, JWT, WS path `/ws/room/:roomId` (unchanged) |
| DO name | `roomId` when `shard_count = 1`, else `roomId#s0` … `roomId#sN-1` |
| WS routing | `hash(userId) % shard_count` picks the shard DO |
| Broadcasts | `POST /messages`, edits, reactions, `POST /events` fan out to **all** shards |

## Configuration

1. Migration `0046` adds `rooms.shard_count` (default `1`).
2. Admin: `PATCH /rooms/:id` with `{ "shardCount": 4 }` (owner/admin).
3. `GET /rooms/:id/live` aggregates sockets/users across shards (`socketIds` included).

## When to enable

- Live stats show sustained high message rate on one room.
- Moderation/terminate still works: terminate scans all shards for `socketId`.

## Limits

- Max **16** shards per room (`MAX_ROOM_SHARDS`).
- Message history stays in D1 (single logical room); only realtime fan-out is sharded.
- Cross-shard presence is aggregated on `/live`, not a global presence graph.

## References

- [Cloudflare DO scaling](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- Internal research: `docs/research/chat-state-cloudflare-do-main` (`shardKey` pattern)
