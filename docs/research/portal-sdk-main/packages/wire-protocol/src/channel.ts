import type { WireMessage } from "./message.js";

// ── Ready-frame sub-shapes (§1.2) ───────────────────────────

/** Channel mode. Decides presence shape and whether `sender.username` is populated. */
export type ChannelMode = "standard" | "broadcast";

/** The channel, as described by the connect snapshot (§1.2). */
export type ChannelInfo = {
  id: string;
  mode: ChannelMode;
  name?: string;
  meta?: Record<string, unknown>;
};

/**
 * What this connection is allowed to do (§1.2).
 *
 * Open-ended by design: the index signature lets the platform add capabilities
 * additively (§6) without breaking older clients. Named keys are the ones observed;
 * absent means not granted.
 *
 * SPEC: §1.2 shows only `publish`, but real `ready` frames also carry `sendDirect`
 * (fixture `channel_ready.me.capabilities`). The full key set is not enumerated in the
 * doc.
 */
export type Capabilities = {
  /** May publish persistent messages via `POST /v1/channels/{id}/messages` (§3.1). */
  publish?: boolean;
  /** May send targeted `to:` messages. Observed in fixtures; not in §1.2. */
  sendDirect?: boolean;
  /**
   * Unrecognised capabilities are `unknown`, not `boolean`: §1.2 neither enumerates the
   * keys nor promises the values stay boolean, and a stricter type would force the
   * parser to reject a whole `ready` frame over one unrecognised capability.
   */
  [capability: string]: unknown;
};

/** The connected user's own verified identity (§1.2). */
export type MeInfo = {
  id: string;
  anon: boolean;
  /** Whatever the token signer signed. Never assembled client-side. */
  claims: Record<string, unknown>;
  capabilities: Capabilities;
};

/**
 * A participant as it appears **on the wire** (§1.2 snapshot, §2.1 `joined` deltas).
 *
 * `username` is present when the participant has one; `metadata` is the session presence
 * metadata (`?meta=` / a `meta` frame). This carries no `claims` — the token's claim bag is
 * the connected user's own (`me.claims` in `ready`), never another participant's.
 */
export type WirePresenceParticipant = {
  id: string;
  anon: boolean;
  username?: string;
  metadata?: Record<string, unknown>;
};

/** Presence snapshot on a standard channel, carried by `ready` (§1.2). */
export type DetailedPresenceSnapshot = {
  mode: "detailed";
  participants: WirePresenceParticipant[];
  count: number;
};

/**
 * Presence snapshot on a broadcast channel, carried by `ready` (§1.2).
 *
 * SPEC: §1.2 defers the snapshot shape to "detailed | aggregate shape, per mode" and no
 * fixture covers aggregate mode, so this is modelled on the §2.1 aggregate frame with
 * `recent` optional. Unverified against a real broadcast `ready`.
 */
export type AggregatePresenceSnapshot = {
  mode: "aggregate";
  count: number;
  /** SPEC: element shape is elided as `[...]` in §2.1. See {@link AggregatePresenceFrame}. */
  recent?: unknown[];
};

/**
 * The `presence` value inside `ready` (§1.2), discriminated on `mode`.
 *
 * Distinct from {@link PresenceFrame}: the snapshot is the full roster
 * (`participants`), while the frame is a delta (`joined`/`left`).
 */
export type ReadyPresence = DetailedPresenceSnapshot | AggregatePresenceSnapshot;

// ── S→C (§1.2, §2.1) ────────────────────────────────────────

/**
 * First frame on a channel socket, exactly once (§1.2).
 *
 * One fat snapshot — there is no staged handshake. Initial history is NOT included;
 * the client fetches `GET /history` (§3.2) in parallel with the upgrade.
 */
export type ChannelReadyFrame = {
  t: "ready";
  channel: ChannelInfo;
  me: MeInfo;
  /** Channel head at snapshot time. The gap-fill baseline (§4). */
  seq: number;
  /** Opaque reconnect token; send it back unchanged as `?leaf=` on the next connect. */
  leaf: string;
  presence: ReadyPresence;
  /** This user's read position. Absent when watermarks are off (§1.2). */
  watermark?: number;
  /**
   * Cached extension snapshots, keyed by namespace. An unavailable extension is
   * key-absent rather than null.
   *
   * SPEC: §1.2 shows `ext` unconditionally, but real `ready` frames omit it entirely
   * (fixture `channel_ready`), so it is optional here.
   */
  ext?: Record<string, unknown>;
  /**
   * Extension namespace → transport, for routing `send()` (§1.2).
   *
   * SPEC: shown unconditionally in §1.2 but absent from the fixture; optional here.
   */
  bindings?: Record<string, string>;
};

/**
 * THE data frame (§2.1). Messages are coalesced per window; `msgs` is ordered and `seq`
 * is contiguous within a connection's delivery stream.
 */
export type BatchFrame = {
  t: "batch";
  msgs: WireMessage[];
};

/**
 * A message was retracted (§2.1).
 *
 * May reference a `seq` the client does not hold yet (the retraction can outrun its
 * message): keep a tombstone set and apply on arrival (§4).
 */
export type RetractFrame = {
  t: "retract";
  id: string;
  seq: number;
  reason?: string;
};

/**
 * Presence delta on a standard channel (§2.1).
 *
 * `joined` carries full participants; `left` carries bare participant ids (a departing
 * participant is identified, not re-described).
 */
export type DetailedPresenceFrame = {
  t: "presence";
  mode: "detailed";
  joined: WirePresenceParticipant[];
  left: string[];
  count: number;
};

/**
 * Presence delta on a broadcast channel (§2.1).
 *
 * SPEC: `recent` is elided as `[...]` in §2.1 and no fixture covers it, so its element
 * shape is unproven. It stays `unknown[]` rather than guessing: narrowing it here would
 * make an invented shape permanent public surface. It awaits a confirmed shape.
 */
export type AggregatePresenceFrame = {
  t: "presence";
  mode: "aggregate";
  count: number;
  recent: unknown[];
};

/** Presence delta (§2.1), discriminated on `mode`. */
export type PresenceFrame = DetailedPresenceFrame | AggregatePresenceFrame;

/**
 * Transient per-user activity — typing, thinking, uploading (§2.1).
 *
 * Never echoed for yourself. Peers expire by absence (~5s client-side); there is no
 * explicit "stopped" frame.
 */
export type ActivityFrame = {
  t: "activity";
  userId: string;
  kind: string;
  /** Epoch milliseconds the activity started. */
  since: number;
};

/** Delivery to THIS connection only — `to:`-sends and targeted pushes (§2.1). */
export type DirectFrame = {
  t: "direct";
  msg: WireMessage;
};

/**
 * Connection reassignment (§2.1). Close and reconnect, sending the new token back
 * as `?leaf=`.
 */
export type ReassignFrame = {
  t: "reassign";
  leaf: string;
};

/**
 * An in-session error (§2.1). `ref` echoes the `cl` tag of the client frame it answers,
 * so a rejected `ephemeral` can be matched back to its send.
 *
 * SPEC: §2.1 shows `"code": "not_permitted"` by example but never enumerates in-session
 * error codes, so `code` is `string`. It is NOT typed as {@link PublishErrorCode}:
 * §2.2 says upstream gates are "identical" to publish gates, but the doc never states
 * the two code sets are the same, and inventing that equivalence here would make it
 * permanent protocol surface.
 */
export type ErrorFrame = {
  t: "error";
  code: string;
  reason?: string;
  ref?: string;
};

/** Keepalive response (§1.3). Shared with the inbox socket. */
export type PongFrame = {
  t: "pong";
};

/** Every frame the platform can send on a channel socket (§1.2, §2.1). */
export type ChannelServerFrame =
  | ChannelReadyFrame
  | BatchFrame
  | RetractFrame
  | PresenceFrame
  | ActivityFrame
  | DirectFrame
  | ReassignFrame
  | ErrorFrame
  | PongFrame;

// ── C→S (§2.2) ──────────────────────────────────────────────

/**
 * The ephemeral lane (§2.2): no persistence, no `seq`, no history. Cursors, transient
 * signals, and ws-transport extension traffic all ride this.
 */
export type EphemeralFrame = {
  t: "ephemeral";
  /** Client tag. An `error` frame answering this send echoes it as `ref`. */
  cl: string;
  type: string;
  content: unknown;
};

/**
 * Announce own activity (§2.2). Throttled client-side (~3s).
 *
 * Distinct from the S→C {@link ActivityFrame}, which adds `userId` and `since`: same
 * `t`, different shape, different direction.
 */
export type ActivityUpFrame = {
  t: "activity";
  kind: string;
};

/** Advance this user's read position (§2.2). Independent of inbox read state (§5). */
export type WatermarkFrame = {
  t: "watermark";
  seq: number;
};

/**
 * Replace this session's presence metadata mid-session (§2.2); the change is
 * re-announced to other participants via presence deltas.
 *
 * `metadata` is client-supplied and presentation-only — it never feeds authorization,
 * which comes from signed token claims. Sends the full replacement bag, not a patch.
 */
export type MetaFrame = {
  t: "meta";
  metadata: Record<string, unknown>;
};

/** Keepalive (§1.3). Shared with the inbox socket. */
export type PingFrame = {
  t: "ping";
};

/**
 * The complete upstream set for a channel socket (§2.2).
 *
 * Persistent publishes are NOT here — they go over HTTP (§3.1).
 */
export type ChannelClientFrame =
  | EphemeralFrame
  | ActivityUpFrame
  | WatermarkFrame
  | MetaFrame
  | PingFrame;
