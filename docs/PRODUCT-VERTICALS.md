# Product verticals (free path)

Hosted remains **open beta**. These modules are **product** on the room Worker: persist, HTTP, console, SDK. They are not Stream/Sendbird Enterprise.

**Out of scope (keep saying no):** hosted SLA, SOC 2 attestation, HIPAA BAA, 99.999% uptime.

## What “product” means here

| Module | Competitor pattern (room layer) | FluxyChat product (free) | Explicitly not |
|---|---|---|---|
| IoT | Device shadow GET/POST, last-seen, desired vs reported | D1 devices, readings, shadow, rules, `iot.reading` fan-out | MQTT broker, device gateway at AWS scale |
| Fleet | Live GPS, geofences, enter/exit | Vehicles, trips, geofences, `fleet.gps_update` | Telematics hardware, ELD compliance |
| Game | Authoritative ticks, leaderboard, saves | `/games/*`, D1 matches, checkpoints | Rollback netcode, dedicated game servers |
| Edu | Polls, breakouts, attendance heartbeats | Polls + breakouts + `attendance.heartbeat` on the room | LMS LTI, FERPA attestation, SFU classroom |
| Stream | Live event + chat overlay | Worker live events + room chat; WHIP/HLS via CF Stream secrets | SFU, Mux replacement |
| Voice AI | STT/TTS session | Workers AI pipeline + `joinVoiceStage` signaling | Published P95 latency, LiveKit replacement |
| Spatial | Scene graph + grants | `/spatial/scenes` D1 + entities + agent grants | Unity/Unreal engine, WebXR headset product |
| Health | Consent + care room events | `health.consent.verified` capability events | HIPAA, FHIR store, BAA |
| Finance | Alerts + human approval | `finance.*` capability events, no PAN | PCI, trade execution, advice |
| Event | Stage live + Q&A | Live events + `event_qa` + `event.stage.live` | Ticket processor, spatial audio |
| Continuity | Checkpoint + resume | `continuity.checkpoint.*` on the room | XR renderer |
| Web3 | SIWE nonce → JWT | Worker `/auth/wallet` + optional address allowlist | On-chain indexer, custody, NFT oracle |
| Marketplace | Install catalog | Agent templates D1 + project apps KV + MCP catalog | Hosted ApyHub tools |

Empty wallet allowlist = any verified wallet. Non-empty = product gate without an RPC.

Capability console JWT roles include `member` so studio actions work on Free.
