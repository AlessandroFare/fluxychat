# Research clones -- index

Local copies of projects studied for FluxyChat. **Do not ship this folder** in npm packages; reference only.

| Folder | Project | License | Relevance |
|--------|---------|---------|-----------|
| [workers-chat-demo-master](./workers-chat-demo-master/) | Cloudflare official DO chat | BSD-3 | **Core** -- hibernation, room routing, IP rate limiter DO |
| [durable-chat-template-main](./durable-chat-template-main/) | CF Durable Chat + PartyServer | CF sample | **Core** -- PartyServer room DX, DO SQL messages |
| [partykit-main](./partykit-main/) | PartyServer / partysocket | ISC | **Core** -- client reconnect, DO `Server` base class |
| [cf-chat-main](./cf-chat-main/) | Nuxt + DO chat (WIP) | BSD-3 | Partial -- dual-DO rate limit idea; code incomplete |
| [chat-state-cloudflare-do-main](./chat-state-cloudflare-do-main/) | Chat SDK state adapter | MIT | Infra -- DO locks, alarms, TTL cleanup |
| [workersai-main](./workersai-main/) | Workers AI chat app | MIT | AI -- typed WS stream events, ConnectRPC split |
| [portal](./portal/) | Portal JS SDK (client only) | MIT | **SDK patterns** -- replay envelope, optimistic send (no public naming) |
| [my-chat-web-main](./my-chat-web-main/) | Next + Workers AI UI | private | UI -- stream batching for React |
| [free4chat-cloudflare](./free4chat-cloudflare/) | Ephemeral RTK rooms + bot DO | MIT | Abuse -- token broker, KV rate limits, scoped AI DO |
| [open-im-server-main](./open-im-server-main/) | OpenIM platform | Apache-2.0 | Scale concepts -- webhooks, msg pipeline (not stack) |
| [sent-dm-typescript-main](./sent-dm-typescript-main/) | Sent.dm SMS/WhatsApp SDK | Apache-2.0 | Adjacent -- outbound notification fan-out |

| [Chatsemble-main](./Chatsemble-main/) | Chatsemble workspace | GPL | Concepts only -- [chatsemble-concepts.md](./chatsemble-concepts.md) (no code import) |

## Main outputs

| Doc | Purpose |
|-----|---------|
| [fluxychat-research-synthesis.md](./fluxychat-research-synthesis.md) | Full analysis + prioritized product backlog |
| [ws-client-benchmark-fluxy.md](./ws-client-benchmark-fluxy.md) | Fluxy-bot npm vs SDK + outbox/heartbeat spec |
| [chatsemble-concepts.md](./chatsemble-concepts.md) | GPL workspace -- safe patterns vs FluxyChat wedge |

## How to use

1. Read **synthesis** for what to build next.
2. Open one clone → one question (e.g. “how does reconnect work?”).
3. File issues in the monorepo; link back to this folder in PR descriptions.

---

## Tier B/C watchlist (weekly review, 15 min)

These repos are tracked as **category reference** -- read them for patterns and positioning, not to clone. Pick **one per week**, file an SDK / Worker / Docs issue if a concrete pattern emerges. If nothing new in 2 quarters, drop the repo from the list.

| Repo | URL | Why watch | Steal when |
|------|-----|-----------|-----------|
| [centrifugal/centrifugo](https://github.com/centrifugal/centrifugo) | ~10k★ | Realtime bus (Go) with subscribe/presence/private channels | New presence / reconnect / RPC primitive in SDK |
| [partysocket/partysocket](https://github.com/partykit/partysocket) | (partykit monorepo) | Browser WS with backoff + query | Compare to `packages/sdk/src/room-connection.ts` |
| [tinode/chat](https://github.com/tinode/chat) | IM server Go + clients | Federation / mobile IM | Only if we add mobile push federation or XMPP bridge |
| [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | Helpdesk / Intercom alt | **What we are not** -- compare positioning only | If a Sendbird-Desk customer asks for helpdesk-style queues |
| [threepointone/durable-chat](https://github.com/threepointone/durable-chat) | DO + Workers AI chat | Small readable codebase | Reference for new DO patterns |

**Saved GitHub searches** (refresh quarterly):

```
durable objects websocket chat language:TypeScript
cloudflare workers chat room D1
partyserver cloudflare workers
pusher alternative self-hosted websocket
websocket reconnect queue typescript
useChat websocket reconnect react
```

**Review checklist** (15 min, Friday):

- [ ] Skim 1 Tier A or Tier B repo's `CHANGELOG` / recent commits → any breaking change vs our mapping?
- [ ] Check [Cloudflare blog](https://blog.cloudflare.com/) for "Durable Objects" / "Workers" / "WebSocket" posts since last review
- [ ] Any deprecation notice from `partykit` (partysocket, partyserver, PartySocket)?
- [ ] Update internal table (repo | reconnect | history store | tenant model | license) in `fluxychat-research-synthesis.md` § Per-repo notes if anything changed
- [ ] File a backlog issue or update `ROADMAP_EXECUTION.md` if a concrete pattern surfaced; otherwise mark this week as `no-action`

