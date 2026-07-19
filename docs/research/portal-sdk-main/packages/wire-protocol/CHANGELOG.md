# @portalsdk/wire-protocol

All notable changes to this package are documented here. This package is versioned
independently of the other `@portalsdk` packages.

## 0.3.0

### Changed

- **Presence participants are `{ id, anon, username?, metadata? }`** everywhere they appear
  — the `ready` presence snapshot and the `presence` delta's `joined`. Presence frames carry
  no `claims`; the token's claim bag remains the connected user's own (`me.claims` in
  `ready`), never another participant's.
- **A presence delta's `left` is a `string[]` of participant ids** — a departing participant
  is identified, not re-described.
- Presence parsing is strict against the shapes above; the provisional presence markers are
  removed (the shapes are now evidence-backed).

### Added

- `key` in `UPGRADE_PARAMS` — the publishable apiKey query parameter on an upgrade (§1
  credential transport), alongside `token`.

## 0.2.0

### Added

- `parseChannelClientFrame` / `parseInboxClientFrame` — C→S parsers for a server (or test
  mock) receiving the frames a client sends. Same totality contract as the S→C parsers:
  `null` on garbage or a bad-shaped known `t`, `UnknownFrame` passthrough for an
  unrecognised `t` (§6), unknown fields preserved across a round-trip.
- `isKnownChannelClientFrame` / `isKnownInboxClientFrame`, and the parsed-frame types
  `ParsedChannelClientFrame` / `ParsedInboxClientFrame`.

## 0.1.0

### Added

- `MetaFrame` (`{ t: "meta"; metadata }`) — a C→S channel frame that replaces a session's
  presence metadata mid-session (§2.2), added to the `ChannelClientFrame` union. Presence
  metadata was previously settable only at upgrade time (`?meta=`).

## 0.0.0

### Added

- Protocol v1 frame types for both socket families, discriminated on `t` and exported
  individually and as per-direction unions: `ChannelServerFrame`, `ChannelClientFrame`,
  `InboxServerFrame`, `InboxClientFrame`.
- `WireMessage` (§2.1) — the wire envelope, `seq` included. `seq` is transport and is
  stripped a layer up, not here.
- The full channel `ready` snapshot (§1.2) and the inbox wire shapes `InboxEntryWire` /
  `InboxItemWire` (§5).
- `RefusalCode` + `REFUSAL_STATUS` + `RefusalBody` and the `PORTAL_ERROR_HEADER`
  constant (§1.1). `PublishErrorCode` is a deliberately separate union (§3.1).
- `PROTOCOL_VERSION` and `UPGRADE_PARAMS` so upgrade URLs are built from constants
  rather than string literals.
- `parseChannelFrame` / `parseInboxFrame` — total and non-throwing, returning `null` for
  non-frames and an `UnknownFrame` passthrough for unrecognised `t` (§6).
- `serializeFrame`, per-frame narrowing guards, and `isRefusalCode`.
- Conformance suite pinning every frame in `fixtures/m3-frames.json`.

### Removed

- The `VERSION` scaffolding stub. It carried no protocol meaning and sat one letter away
  from `PROTOCOL_VERSION` on permanent public surface.
