import type { PingFrame, PongFrame } from "./channel.js";

// ── Wire shapes (§5) ────────────────────────────────────────

/**
 * One conversation row in the inbox (§5).
 *
 * `muted` silences aggregation, not data: a muted entry keeps updating and stops
 * contributing to the counter, but items addressed to you still land.
 */
export type InboxEntryWire = {
  /** The channel id this row tracks. */
  id: string;
  name?: string;
  meta?: Record<string, unknown>;
  /** Preview of the most recent message. Absent on large channels (seq-only tier). */
  latest?: {
    text: string;
    sender: { id: string };
    at: number;
  };
  unread: number;
  muted: boolean;
  /** Recency, epoch milliseconds. The sort key. */
  at: number;
};

/**
 * A targeted item: a mention, a `to:`-send, or a notify descriptor (§5).
 *
 * Items carry per-item read state, unlike channels which are positional (watermark).
 */
export type InboxItemWire = {
  /** Event id; the idempotency key. */
  id: string;
  /** Userland: `"mention"`, `"ticket.assigned"`, … */
  type: string;
  title?: string;
  /** Userland payload. Opaque to the platform and to this package. */
  data: unknown;
  /** Present when the item originated in a channel (mention, `to:`-send). */
  channelId?: string;
  at: number;
  read: boolean;
};

// ── S→C (§5) ────────────────────────────────────────────────

/**
 * First frame on an inbox socket (§5).
 *
 * Anonymous tokens never get here — they are refused at the upgrade with 403
 * `anonymous_not_allowed`, because no inbox exists for them.
 */
export type InboxReadyFrame = {
  t: "ready";
  entries: InboxEntryWire[];
  items: InboxItemWire[];
  counter: number;
};

/** A row upsert — preview, unread, or mute changed (§5). */
export type InboxEntryFrame = {
  t: "entry";
  entry: InboxEntryWire;
};

/** A targeted item arrived (§5). */
export type InboxItemFrame = {
  t: "item";
  item: InboxItemWire;
};

/** The global badge changed (§5). Pushed on change. */
export type InboxCounterFrame = {
  t: "counter";
  n: number;
};

/** Every frame the platform can send on an inbox socket (§5). */
export type InboxServerFrame =
  | InboxReadyFrame
  | InboxEntryFrame
  | InboxItemFrame
  | InboxCounterFrame
  | PongFrame;

// ── C→S (§5) ────────────────────────────────────────────────

/**
 * Advance the inbox position for one channel — clears its sidebar badge (§5).
 *
 * NOT the channel watermark: the inbox tracks *noticing*, the channel tracks *reading*,
 * and the two may legitimately disagree.
 */
export type InboxReadFrame = {
  t: "read";
  channelId: string;
};

/** Flip one item's read flag (§5). Never cascades to older items. */
export type InboxItemReadFrame = {
  t: "item.read";
  id: string;
};

/** Mark ALL items read (§5). Global and zero-arg — it ignores any client-side filter. */
export type InboxReadAllFrame = {
  t: "read.all";
};

/** Set the durable per-user-per-channel mute preference (§5). */
export type InboxMuteFrame = {
  t: "mute";
  channelId: string;
  muted: boolean;
};

/** The complete upstream set for an inbox socket (§5). */
export type InboxClientFrame =
  | InboxReadFrame
  | InboxItemReadFrame
  | InboxReadAllFrame
  | InboxMuteFrame
  | PingFrame;
