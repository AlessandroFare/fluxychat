# Labs / verticals clone bar (same method as Ably)

Ably kernel HOW is done except two-browser mid-token E2E. Detail: `docs/ably-sdk-lessons.md` + `docs/research/ably/GAP-TRACKER.md`.

This campaign does the **same thing** for labs and verticals: local clones, **HOW vs HOW**, reimplement in Fluxy files, do not paste their source.

Clones live under `docs/research/` (gitignored). Master checkbox list: `docs/research/GAP-TRACKER.md`. One tracker per vendor in that vendor folder.

Do **one vendor at a time** (Italian `vai` continues the current vendor, not the next). Order below.

Homepage verticals stay: war room, shared AI room, deal room, live cursors. Labs stay optional: stream, game, IoT, fleet. No HIPAA/BAA. Voice is transcripts + `joinVoiceStage`, not an SFU product.

## Rules (same as Ably)

- Follow **behaviour and API shape**. Reimplement. Do not vendor their tree into `packages/` or `apps/`.
- “We already have it” is not “as good as theirs”.
- No invented traction. Hosted SAML stays off.
- Skip their company: hosted mesh, Control API SaaS, MQTT broker as a product, dedicated game servers, telematics hardware, overlay Electron apps as a SKU.

## Order (one by one)

| # | Vendor | Tracker | Clone paths (repo-relative) | Why first / later |
| --- | --- | --- | --- | --- |
| 1 | Liveblocks | `docs/research/liveblocks/GAP-TRACKER.md` | `docs/research/liveblocks/liveblocks-main` | Collab, presence, comments, Yjs, inbox — closest to `/collab` + cursors |
| 2 | Stream Chat | `docs/research/getstream/GAP-TRACKER.md` | `docs/research/getstream/stream-chat-js-master`, `docs/research/getstream/stream-chat-react-master` | Product chat UI (threads, unread, composer) vs Ably kit |
| 3 | Yjs | `docs/research/yjs/GAP-TRACKER.md` | `docs/research/yjs/yjs-main`, `docs/research/yjs/y-websocket-master` | Awareness / provider HOW; we already bind Yjs on the room |
| 4 | tldraw | `docs/research/tldraw/GAP-TRACKER.md` | `docs/research/tldraw/tldraw-main` | Canvas, locks, comments, sync |
| 5 | Colyseus | `docs/research/colyseus/GAP-TRACKER.md` | `docs/research/colyseus/colyseus-master` | Game ticks, room presence (labs) |
| 6 | Nakama | `docs/research/nakama/GAP-TRACKER.md` | `docs/research/nakama/nakama-master` | Game server HOW |
| 7 | Cloudflare Agents | `docs/research/cloudflare/GAP-TRACKER.md` | `docs/research/cloudflare/agents-main` | One agent in a DO vs our room + `invokeAgent` |
| 8 | Chatwoot | `docs/research/chatwoot/GAP-TRACKER.md` | `docs/research/chatwoot/chatwoot-develop` | Support inbox vertical |
| 9 | Traccar | `docs/research/traccar/GAP-TRACKER.md` | `docs/research/traccar/traccar-master` | Fleet GPS vertical |
| 10 | Overlayed | `docs/research/overlayed/GAP-TRACKER.md` | `docs/research/overlayed/overlayed-main` | Stream overlay labs (not an Electron SKU) |
| 11 | ThingsBoard | `docs/research/thingsboard/GAP-TRACKER.md` | `docs/research/thingsboard/thingsboard-master` | IoT HTTP + shadow (not MQTT) |
| 12 | BigBlueButton | `docs/research/bigbluebutton/GAP-TRACKER.md` | `docs/research/bigbluebutton/bigbluebutton-3.0.x-develop` | Edu breakouts / attendance |
| 13 | LiveKit JS | `docs/research/livekit/GAP-TRACKER.md` | `docs/research/livekit/client-sdk-js-main` | Voice signaling HOW — not an SFU SKU |
| 14 | Botpress | `docs/research/botpress/GAP-TRACKER.md` | `docs/research/botpress/botpress-master` | Chatbot builder rules |
| 15 | OwnTracks | `docs/research/owntracks/GAP-TRACKER.md` | `recorder` + `json-schema` (not ios/android) | Driver / fleet location JSON |
| 16 | n8n | `docs/research/n8n/GAP-TRACKER.md` | `docs/research/n8n/n8n-master` | Trigger-action vs Worker rules |

Vendors 1–16 closed (wave 2). Worker-backed modules (stream, game, IoT, fleet, edu, chatbot, health/finance/event/continuity events) are labeled production: persist + auth + tenancy + tests. Huddles media, spatial, cartography, transport stay labs. No HIPAA BAA. No SFU SKU. No MQTT broker. Hosted is still open beta. Two-browser mid-token E2E unclaimed.

## Close rule (wave 2)

Inventory the clone’s **public routes** (controllers / OpenAPI / SDK exports). Every resource gets Them / Fluxy / Follow. Tick only after the Fluxy route exists and has a test. Skip is for SKUs we refuse (MQTT broker, SFU product, native apps), not for “we’ll do it later.”

## Do in order (process)

1. Inventory the clone (packages, public API, license).
2. Pass 1: missing vs us.
3. Pass 2: we have it, thinner HOW.
4. Follow list in that vendor’s `GAP-TRACKER.md`.
5. Implement in Fluxy. Tick boxes. Do not commit unless asked.

Italian `vai` / `vai avanti` on this campaign means continue the **current** vendor’s Follow list, same as Ably.
