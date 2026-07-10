# Roadmap: Realtime Features — Gap Analysis

Feature-parity audit against competitor "realtime SDK" positioning
(In-App Chat, Live Streaming, Real-Time Location, Push Notifications).

## Audit summary

| Capability | Status | Where it lives | Showcase |
|---|---|---|---|
| In-App Chat | **Supported** | `packages/sdk` (`useChat`, `FluxyChatClient`), `apps/worker` rooms | `apps/dashboard/app/features/realtime` (In-App Chat tab) |
| Live Streaming (high fan-out pub/sub + presence) | **Supported** | `packages/sdk` client events (`sendClientEvent`, `client_event`), `presenceMembers` / `subscriptionCount`, `apps/worker` WS fan-out | `apps/dashboard/app/features/realtime` (Live Streaming tab) |
| Push Notifications (offline delivery + external fallback) | **Supported** | `packages/sdk` (`useWebPush`, VAPID register/list/unregister), `apps/worker` web push + Slack/Discord bridges + email digest | `apps/dashboard/app/features/realtime` (Push Notifications tab) |
| Real-Time Location (continuous position streaming) | **Not supported** | Only one-time location *attachments* exist (`packages/sdk/src/attachments.ts`) | Spec below — not built |

Per the task rules, the three supported capabilities got working dashboard
showcases backed by real SDK calls; the unsupported one gets this spec.

---

## Spec: Real-Time Location Streaming

### What exists today

- A static `location` attachment type: a user shares their position once
  (browser `geolocation.getCurrentPosition`) and it is sent as a message
  attachment. No continuous updates, no live map, no per-device tracks.
- Generic ephemeral pub/sub via client events (`sendClientEvent`), which is
  a viable transport but has no location-specific semantics: no coalescing,
  no last-known-position snapshot for late joiners, no track identity.

### Goal

Stream device position updates through a room so every viewer sees a dot
that is always where the device actually is — the competitor's
`navigator.geolocation.watchPosition -> channel.publish` pattern, but with
first-class semantics.

### Proposed API surface

**Publisher (JS SDK, `packages/sdk`):**

```ts
const track = client.locationTrack(roomId, { trackId: "driver-42" });

navigator.geolocation.watchPosition((p) => {
  track.publish({
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracy: p.coords.accuracy,
    heading: p.coords.heading,
    speed: p.coords.speed,
  });
});

track.stop(); // ends the track, broadcasts `track_ended`
```

**Subscriber (React):**

```ts
const { tracks } = useLocation({ roomId });
// tracks: Map<trackId, { position, updatedAt, userId, status }>
```

**Wire protocol (`packages/protocol`):** new WS frames

- `location_update` `{ roomId, trackId, userId, lat, lng, accuracy?, heading?, speed?, ts }`
- `location_snapshot` — last known position of every active track, sent on
  subscribe (late-joiner catch-up)
- `location_track_ended` `{ roomId, trackId }`

### Data flow

1. Publisher SDK throttles/coalesces raw `watchPosition` callbacks
   (default: max 1 update/sec, drop intermediate points; configurable).
2. Worker (`apps/worker`) receives `location_update` on the room WS,
   updates an in-memory last-known-position map on the room Durable
   Object (NOT persisted to message history — positions are ephemeral),
   and fans out to all subscribers like a client event.
3. On subscribe, the Worker sends `location_snapshot` so a late joiner
   immediately renders every active dot.
4. TTL sweep: tracks with no update for N seconds (default 30) are marked
   stale and broadcast as `track_ended`.

### Package placement

| Package | Work |
|---|---|
| `packages/protocol` | New frame types + zod schemas |
| `apps/worker` | Room DO: last-known-position map, snapshot on join, TTL sweep, fan-out |
| `packages/sdk` | `client.locationTrack()`, `useLocation()` hook, throttling |
| `packages/react-native-sdk` | Same publisher API on top of RN geolocation |
| `packages/flutter-sdk` | Same publisher API on top of `geolocator` |
| `apps/dashboard` | Showcase tab: live map preview (Leaflet/Mapbox) + code panel |

### Estimated complexity

- Protocol + Worker fan-out/snapshot/TTL: **M** (builds on existing client
  event fan-out; the new parts are the snapshot map and sweeps)
- JS SDK publisher/hook: **S–M**
- RN + Flutter parity: **M** (platform geolocation permissions/lifecycle)
- Dashboard map showcase: **S**

### Open design questions

1. **Persistence:** should tracks optionally persist (trip history/replay),
   or stay strictly ephemeral? Persisting implies a new D1 table and
   retention rules.
2. **Authorization:** can any room member publish a track, or is it gated
   by a room role/permission (e.g. only `publisher` members)?
3. **Precision controls:** offer server-side coordinate fuzzing (privacy)
   per room policy, similar to existing data-classification labels?
4. **Scale ceiling:** one DO per room caps fan-out; do high-viewer tracking
   rooms need the same fan-out tiering as live streaming rooms?
5. **Battery/permissions UX:** RN/Flutter background location tracking has
   heavy platform policy implications — in-foreground only for v1?
