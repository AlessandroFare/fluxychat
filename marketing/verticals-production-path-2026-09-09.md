# Verticals: time to sellable production

2026-09-09, revised after source check · 1 person + AI ~25h/week.

Production = auth, limits, tests, gallery, a founder can ship. Not specialist parity.

Official sources used in this revision: [Realtime overview](https://developers.cloudflare.com/realtime/), [SFU pricing](https://developers.cloudflare.com/realtime/sfu/pricing/), [SFU limits](https://developers.cloudflare.com/realtime/sfu/limits/), [RealtimeKit pricing](https://developers.cloudflare.com/realtime/realtimekit/pricing/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [workerd#6451](https://github.com/cloudflare/workerd/issues/6451), [viem SIWE](https://viem.sh/docs/siwe/actions/verifySiweMessage).

## Correction: Huddles should not start with LiveKit + VPS

Cloudflare already sells a production SFU on the same account as Workers: **Realtime SFU** (old name: Calls). Docs: 1,000 GB egress/month free, then $0.05/GB. TURN shares that pool. Inbound media to Cloudflare is free. The SFU has **no rooms**. Sessions = PeerConnections, Tracks = media. That matches Fluxy: the Durable Object is the room; the SFU is only the switchboard.

That is the default for Huddles and for Voice media. You already mint LiveKit JWTs; keep that as a fallback if a customer brings their own LiveKit. Do not stand up a VPS first.

Do **not** default to **RealtimeKit**. It is a meeting SDK (rooms, presets, UI) priced per participant-minute, and the public plans table marks it unavailable on the Free plan. SFU 1 TB is the free path. RealtimeKit duplicates “room” and will bill like Daily when GA.

Effort: SFU is unopinionated. You write signaling (who may pull which track) on the room DO. Cloudflare’s own docs say high effort / WebRTC knowledge. Budget 3–5 weeks, still zero extra servers. Examples: [cloudflare/realtime-examples](https://github.com/cloudflare/realtime-examples).

1 TB of audio huddles is a lot (opus-scale, small groups). Video grid eats it faster. Still the right free-tier product. Not a substitute for Stream HLS/DVR.

## Workers AI quota (now known)

[Official](https://developers.cloudflare.com/workers-ai/platform/pricing/): **10,000 Neurons/day**, both Free and Paid, reset 00:00 UTC. Over that: HTTP 429 code 3036 unless Workers Paid ($0.011 / 1,000 Neurons). Some frontier LLMs need Paid even under quota.

Audio, from the same page (not blog anecdotes):

- `@cf/openai/whisper` → 41.14 neurons per audio minute → ~243 min/day
- `@cf/openai/whisper-large-v3-turbo` → 46.63 neurons per audio minute → ~214 min/day
- MeloTTS → 18.63 neurons per audio minute

A “~170 neurons per transcription” number from random posts is not the meter. Use minutes.

## Table

| Module | Code today | Sellable | Free path (use this) | Skip |
|---|---|---|---|---|
| Edu | Polls, stage events | 3–5 weeks | Stay on the room | BigBlueButton (full conferencing stack). You already have chat + polls. |
| IoT HTTP | ingest + `iot.reading` | 3–4 weeks | Device token, shadow, quota | MQTT in Workers. If a plant has MQTT: **Mosquitto** (simple) or EMQX (scale), then POST into Fluxy. |
| Fleet | GPS, geofence | 4–6 weeks | Leaflet + OSM | Traccar only for 200+ hardware protocols. Laravel GPS-Tracker clones are narrower. |
| Web3 | SIWE in `wallet-siwe.js` | 2–3 weeks | Keep noble hashes you already use, or `viem/siwe` (`createSiweMessage` / `verifySiweMessage`). No extra `siwe` package required. | NFT marketplace |
| Marketplace | KV manifests | 4–6 weeks | Two templates + grants | Building an app store |
| **Huddles** | LiveKit JWT mint | **3–5 weeks, no VPS** | **Realtime SFU + TURN, 1 TB/mo.** Room DO does presence and track grants. | RealtimeKit as default (per-minute, not on Free). LiveKit VPS unless they insist. mediasoup/Janus/Jitsi = more ops. |
| Stream overlay | CF Stream secrets | 2–3 weeks overlay | Overlay is yours. Media: **MediaMTX** (OSS ingest) if you refuse Stream’s $5 min. | Treating Stream as free. OvenMediaEngine is heavier; MediaMTX is the usual lightweight pick. |
| Game | D1 ticks | 6–8 weeks slow | Keep ticks on the room | Colyseus/Nakama as the Fluxy kernel. Both are Node/Go processes. Nakama is a whole game backend; overkill. |
| Voice | STT/TTS + stage signal | 6–8 weeks one room | Whisper on Workers AI (quota above) + **same Realtime SFU** for the audio path | Piper/GPU TTS until you outgrow Workers AI. No latency SLA. |
| Spatial | D1 scenes | 8–12 weeks demo | Three.js + Yjs | Hyperfy / iR Engine (whole world platforms). |
| Health | consent events | 2–3 weeks events | Events only | HIPAA BAA |
| Transport | WS + degraded-http | 1 week copy | Honest fallback | Inbound WebTransport ([workerd#6451](https://github.com/cloudflare/workerd/issues/6451), not on roadmap) |

## Order this quarter

1. Kernel (agent + Yjs).
2. Edu or fleet.
3. Huddles on **Realtime SFU**, not a LiveKit box.
4. IoT HTTP when a device appears.
5. Stream overlay only if someone has OBS.
6. Still off the sales email: spatial, rollback netcode, MQTT, HIPAA, WebTransport.

## What I could not determine

Whether your Cloudflare account already has Realtime SFU enabled in the dashboard (one checkbox, not a code fact). OSM tile fair-use for a public fleet map at scale. RealtimeKit beta-free status on *your* account (plans page still says not on Free; do not plan around a beta).

## Link audit (all listed URLs)

Pass 9 Sep 2026. Verdicts: **use**, **skip**, **noise**. Stars are GitHub as fetched that day.

### Authoritative (use)

| Source | What it actually says |
|---|---|
| [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) | 10,000 Neurons/day Free and Paid, reset 00:00 UTC. Over: fail until Workers Paid at $0.011 / 1,000 Neurons. Whisper 41.14 n/min; whisper-large-v3-turbo 46.63; MeloTTS 18.63. Some frontier LLMs need Paid even under quota. |
| [Realtime SFU pricing](https://developers.cloudflare.com/realtime/sfu/pricing/) | SFU + TURN share **one** 1,000 GB free pool, then $0.05/GB egress (CF → client). Inbound to CF free. TURN↔SFU or TURN↔Stream WHIP/WHEP is not double-billed. |
| [TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/) | STUN `stun.cloudflare.com` free unlimited. TURN for P2P NAT; SFU for fan-out. Same fleet; pick topology, not “faster product”. Teleop/robotics is a documented TURN use. Credentials max 48h. |
| [SFU example architecture](https://developers.cloudflare.com/realtime/sfu/example-architecture/) | Your backend owns rooms/members; CF only SDP + tracks. Matches Fluxy DO as room. |
| [CF blog: Realtime + RealtimeKit](https://blog.cloudflare.com/introducing-cloudflare-realtime-and-realtimekit/) | SFU/TURN GA at 5¢/GB after 1 TB. RealtimeKit = Dyte team + meeting SDKs. **Launch** said closed beta at no cost; **current plans page** is the billing source, not the blog. |
| [cloudflare.com/products/realtime](https://www.cloudflare.com/products/realtime/) | Marketing for **RealtimeKit** (meetings, voice agents, recording). Not the SFU docs. |
| [cloudflare/realtime-examples](https://github.com/cloudflare/realtime-examples) | Canonical SFU samples. Use these. |
| [npm `@cloudflare/realtimekit` 2.0.2](https://registry.npmjs.org/@cloudflare/realtimekit/latest) | Meeting SDK (~5 MB unpacked). Still pulls `@dyteinternals/proto-entities`. Not the SFU API. |
| [dyte-io/react-samples](https://github.com/dyte-io/react-samples) (~58★) | RealtimeKit UI kit samples. Same product as above. |
| [eclipse-mosquitto/mosquitto](https://github.com/eclipse-mosquitto/mosquitto) (~11.2k★) | Lightweight MQTT. Default if a customer already has MQTT → HTTP POST into Fluxy. |
| [emqx/emqx](https://github.com/emqx/emqx) (~16.7k★) | Scale MQTT. EMQ’s own comparison is sales copy. License shifted: Apache ≤5.8, **BSL 1.1 from 5.9** — do not treat current EMQX as “just Apache OSS”. |
| [bluenviron/mediamtx](https://github.com/bluenviron/mediamtx) (~20k★) | Default OSS ingest if you refuse CF Stream’s paid minutes. Site: [mediamtx.org](https://mediamtx.org/). |
| [OvenMediaLabs/OvenMediaEngine](https://github.com/OvenMediaLabs/OvenMediaEngine) / [AirenSoft/OvenMediaEngine](https://github.com/AirenSoft/OvenMediaEngine) (~3.2–3.3k★) | Same product, two org names. Heavier than MediaMTX (transcode, LL-HLS). Skip unless you need that. |
| [livekit/livekit](https://github.com/livekit/livekit) (~20.8k★) | Full realtime stack. Keep JWT mint as customer-brings-LiveKit. Do not run it as Fluxy’s default SFU. |
| [versatica/mediasoup](https://github.com/ibc/mediasoup) (~7.3k★), [meetecho/janus-gateway](https://github.com/meetecho/janus-gateway) (~9.2k★), [jitsi/jitsi-meet](https://github.com/jitsi/jitsi-meet) (~30k★) | Real SFUs/apps. You operate them. Wrong default vs CF Realtime SFU. |
| [bloggeek OSS media servers](https://bloggeek.me/webrtc-tools/media-servers-oss/) | Independent snapshot (Jun 2026): LiveKit momentum, Jitsi if you want a full app, skip OpenVidu if you’d rather buy a Video API. Does **not** mention Cloudflare SFU. |
| [bigbluebutton/bigbluebutton](https://github.com/bigbluebutton/bigbluebutton) + [Wikipedia](https://en.wikipedia.org/wiki/BigBlueButton) | Full virtual classroom OS (HTML5, LMS embeds, 3.0 in 2025). Not a library. Do not absorb. |
| [traccar/traccar](https://github.com/traccar/traccar) (~7.7k★) | Hardware protocol zoo. Only if devices are not HTTP GPS. |
| [eusonlito/GPS-Tracker](https://github.com/eusonlito/GPS-Tracker) (~350★) | Laravel, few brands. Skip. |
| [colyseus/colyseus](https://github.com/colyseus/colyseus) (~7.3k★) + [docs 0.18](https://docs.colyseus.io/) | Node game server, rollback in 0.18. Different process than a Worker DO. |
| [heroiclabs/nakama](https://github.com/heroiclabs/nakama) (~13.3k★) | Full game backend (Go). Overkill as Fluxy kernel. |
| [rhasspy/piper](https://github.com/rhasspy/piper) (~11.3k★) | Local TTS. After Workers AI quota/quality, not before. |
| [hyperfy-xyz/hyperfy](https://github.com/hyperfy-xyz/hyperfy) (~300★) | World builder, small. Not a Fluxy spatial kernel. |
| [thirdroom/thirdroom](https://github.com/thirdroom/thirdroom) (~648★) | Matrix worlds. Whole platform. Skip. |
| [cloudflare/meet](https://github.com/cloudflare/meet) (~2.3k★) | CF meet UI experiment. Not a substitute for wiring SFU + DO. |

### Skip / noise (do not cite in product copy)

**Affiliate / roundup blogs (Neurons):** Medium “free AI APIs”, Novita comparison, PricePerToken, freeaiapi.org, Easton tutorial, toolfreebie, aicreditmart. They repeat “10k Neurons” but are not the meter. Use CF docs.

**Community:** [Workers AI quota stuck at 0](https://community.cloudflare.com/t/workers-ai-free-neuron-quota-remains-blocked-after-daily-reset-dashboard-shows-0/955229) — fetch 403 from here; treat as an **ops bug**, not “quota undefined”.

**Classroom marketplaces:** Capterra BBB alternatives, Toolradar “best virtual classrooms” — competitor lists, not architecture.

**BBB forks / topics:** `codnee`, `farhatahmad`, `alijiemmanuel-dev`, `OasAIStudio`, `github.com/topics/bigbluebutton`, `topics/virtual-classroom`. Forks and tag pages.

**MQTT:** Almost every “Mosquitto vs EMQX vs NanoMQ” page is [EMQX marketing](https://www.emqx.com/en/blog/emqx-vs-mosquitto-2023-mqtt-broker-comparison) (same post on DEV). Useful fact from it: Mosquitto = edge/single node; EMQX = cluster. Ignore 100M-connection hero numbers for Fluxy. iotbyhvm, scadaprotocols, gappsy = more of the same.

**Fleet topics:** `topics/traccar`, `vehicle-tracking`, `fleet-tracking`, `gps-tracking`, `reachnetworks/traccar`. XB Software commercial vs OSS blog = sales.

**WebRTC vendor posts:** Forasoft SFU/Agora/architecture, Trembit LiveKit vs mediasoup (telemedicine), [Stream.io LiveKit alternatives](https://getstream.io/blog/livekit-alternatives/) (competitor). OpenVidu 3.1.0 performance URL redirected; BlogGeek already says skip OpenVidu. `carbonteq/livekit-server` = fork.

**CF noise:** `docs.realtime.cloudflare.com` logo SVG; [RealtimeKit “build your own UI”](https://developers.cloudflare.com/realtime/realtimekit/build-your-own-ui/) **404**. `Eren2yeager/realtime` unrelated. `github.com/topics/webrtc-call`. [CB Insights PartyKit](https://www.cbinsights.com/investor/partykit) irrelevant.

**Stream forks:** `bchah`, `x-junkang`, `qu1rk3y` OvenMediaEngine; `eyepop-mediamtx`; `shivamskr151/webrtc_player`; `topics/webrtc` C++, `topics/streaming-server`.

**Game:** Cinevva browser-game guide, LocalToNet NAT tunnel blog, Crux “Nakama pricing”, RimuruDev star list, `alto-io/game3.js#3`. Use Colyseus/Nakama **canonical** sites only.

**TTS:** `topics/elevenlabs-alternative`, `topics/piper-tts`, LibHunt piper, Pinggy/OfflineTTS roundups, Voice Creator Pro vs Piper (commercial), `sarmakska/voice-agent-starter` wiki, `brooqs/steward`.

**Spatial:** `topics/metaverse-*`, `topics/three-js`, `topics/3d-web`, `battlejoose/hyperfy`, `NarinderBrar/Metaverse`, threejsresources Hyperfy listing, HackMD notes.

### Facts this pass added

1. **Marketing page vs docs:** `cloudflare.com/products/realtime` sells RealtimeKit. Huddles code path is SFU + TURN docs, not that page.
2. **RealtimeKit npm is Dyte.** 2.0.2, still `@dyteinternals`. Confirm skip-as-default.
3. **EMQX is no longer plainly Apache** on current major (BSL 1.1 ≥5.9). Prefer Mosquitto for a customer bridge unless they already run EMQX.
4. **TURN FAQ robotics** is extra justification for **Fleet + Huddles** sharing TURN, not a new product.
5. **Hyperfy ~300★** — not a serious absorption target. Third Room is Matrix, not Three.js+Yjs.
6. **Colyseus 0.18** documents rollback; that is why “don’t put it in the DO” is sharper, not softer.

### Still not opened (blocked or worthless)

Community thread 403. npmjs.com HTML bot wall (registry JSON worked). RealtimeKit UI docs 404. Dozens of GitHub **topic** pages: listing, not a product.
