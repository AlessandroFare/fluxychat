/**
 * Public API surface for `@portalsdk/core`.
 *
 * Only client-observable types live here. Transport concerns — `seq`, frame shapes,
 * reconnect tokens — belong to `@portalsdk/wire-protocol` and are stripped at this edge;
 * they never appear in these types.
 */

import type { PortalError } from "./errors.js";

export type Unsubscribe = () => void;

// ── Client configuration (§1) ───────────────────────────────

export interface PortalConfig {
  /** Publishable key identifying the app; safe in the bundle. */
  apiKey: string;
  /**
   * Identifies the user. A callback is re-invoked on connect, reconnect, and expiry
   * (recommended); a plain string is used as-is (static or short-lived sessions).
   *
   * Optional: omit it for anonymous mode. With no token the SDK mints and manages its own
   * anonymous credential on first use, keeping one stable anonymous identity across
   * refreshes. Supply a token later (e.g. on login) with {@link Portal.setToken}.
   */
  token?: string | (() => Promise<string>);
  /**
   * Base URL overrides. Production hosts are baked in; set these to point at a local or
   * mock server. Primarily for development and testing.
   */
  apiUrl?: string;
  realtimeUrl?: string;
}

export interface ChannelOptions {
  /** Initial backfill on connect; default 50; "none" = live-only start. */
  history?: number | "none";
  /** Initial presence metadata for this session. */
  metadata?: Record<string, unknown>;
}

// ── Message model (§3) ──────────────────────────────────────

/** Platform-owned envelope fields. */
export interface Envelope {
  /** Platform-assigned; dedup + mutation key. */
  id: string;
  channelId: string;
  /**
   * `username` is populated only on broadcast channels; on standard channels the sender
   * is `{ id, anon }` and display data is joined app-side by id.
   */
  sender: { id: string; anon: boolean; username?: string };
  timestamp: number;
  /** Targeted delivery (§4). */
  to?: string;
  /** Declared by sender, verified by the platform (members-only, deduped, capped). */
  mentions?: { userId: string }[];
  /** Flips in place; content stripped per policy. */
  retracted: boolean;
  ephemeral: boolean;
  /**
   * Envelope content class. Media kinds ("image" | "audio" | "file") and attachments are
   * reserved surfaces: typed, rejected in v1.
   */
  kind: "text";
}

/** Envelope + userland payload. */
export interface Message<M = unknown> extends Envelope {
  /** Userland discriminator; default "message". */
  type: string;
  /** Customer payload, ≤2KB, opaque to the platform. */
  content: M;
  /** SDK-derived (not on the wire). */
  unread: boolean;
  /**
   * Local delivery state of own messages (optimistic → ack → rejection). The union is
   * intentionally open: further delivery states are reserved and not emitted in v1.
   */
  status: "pending" | "sent" | "failed";
}

// ── send (§4) ───────────────────────────────────────────────

export type SendInput<M> = PersistentSend<M> | EphemeralSend<M>;

export interface PersistentSend<M> {
  ephemeral?: false;
  /** The channel's content shape; for chat, a string. */
  content: M;
  /** Declared, not parsed — from the customer's autocomplete (presence ∪ members()). */
  mentions?: { userId: string }[];
  /**
   * Delivery instruction: skip fan-out, deliver to this member only, write their inbox
   * item. v1: must be a member. A field named `to` inside content routes nothing.
   */
  to?: string;
  /** Only for mixed-vocabulary channels; default "message". */
  type?: string;
  /** Default "text"; media kinds rejected in v1. */
  kind?: "text";
}

export interface EphemeralSend<M> {
  ephemeral: true;
  /** No persistence, no seq, no history (cursors, transient signals). */
  content: M;
  /** Only for mixed-vocabulary channels; default "message". */
  type?: string;
}

export interface SendAck {
  id: string;
  timestamp: number;
}

// ── where grammar (§6) ──────────────────────────────────────

export type Op<V> = { eq?: V | V[]; neq?: V | V[]; in?: V[]; gt?: V; lt?: V };
export type Where<F> = { [K in keyof F]?: Op<F[K]> };

type Scalar = string | number | boolean;

/** Envelope fields + scalar fields of the content type, flattened. Envelope wins collisions. */
export type Filterable<T, Env> = Env &
  (T extends object ? { [K in keyof T as T[K] extends Scalar ? K : never]: T[K] } : {});

export type MessageWhere<M> = Where<
  Filterable<
    M,
    {
      id: string;
      type: string;
      to: string;
      sender: string;
      timestamp: number;
      retracted: boolean;
      unread: boolean;
    }
  >
>;

export type InboxWhere<D> = Where<
  Filterable<
    D,
    {
      type: string;
      channelId: string;
      read: boolean;
      muted: boolean;
    }
  >
>;

export interface InboxQuery<D> {
  /** Scope the entire view (items + entry) to one channel. */
  channelId?: string;
  where?: InboxWhere<D>;
}

// ── Presence (§7) ───────────────────────────────────────────

export interface DetailedPresence {
  kind: "detailed";
  participants: {
    id: string;
    anon: boolean;
    username?: string;
    metadata?: Record<string, unknown>;
  }[];
  count: number;
}

export interface AggregatePresence {
  kind: "aggregate";
  count: number;
  recent: { id: string; action: "join" | "leave"; at: number }[];
}

// ── Channel handle (§2) ─────────────────────────────────────

export type ChannelStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "reconnecting"
  /** Extension namespace degraded; the channel itself keeps working. */
  | "degraded"
  /**
   * Socket down + reconnecting, but HTTP publish still works: you can speak, incoming
   * may lag until reconnect gap-fill heals it.
   */
  | "degraded-http"
  /** Terminal refusal (bad key, banned, not a member, at capacity). */
  | "blocked";

export interface ActivityEntry {
  userId: string;
  kind: string;
  since: number;
}

export interface ChannelInfo {
  id: string;
  mode: "standard" | "broadcast";
  name?: string;
  meta?: Record<string, unknown>;
}

export interface MemberRow {
  userId: string;
  online: boolean;
  claims: Record<string, unknown>;
}

export interface ChannelEvents<M> {
  message: (msg: Message<M>) => void;
  /** Fires when a message's mentions[] include your userId. */
  mention: (msg: Message<M>) => void;
  retract: (messageId: string) => void;
  presence: (p: DetailedPresence | AggregatePresence) => void;
  activity: (a: readonly ActivityEntry[]) => void;
  status: (s: ChannelStatus, error?: PortalError) => void;
}

export interface ChannelSnapshot<M = unknown> {
  messages: readonly Message<M>[];
  presence: DetailedPresence | AggregatePresence | undefined;
  activity: readonly ActivityEntry[];
  status: ChannelStatus;
  unread: number;
  info: ChannelInfo | undefined;
  me: { id: string; anon: boolean; claims: Record<string, unknown> } | undefined;
  isLoadingPrevious: boolean;
  hasPrevious: boolean;
}

export interface ChannelHandle<M = unknown> {
  /** count++; first acquire opens the connection (the token is resolved here). */
  acquire(): void;
  /** count--; zero + grace (~seconds) → teardown. React pairs these via effect cleanup. */
  release(): void;
  /** Optional sugar: `using ch = portal.channel(id)` releases at scope exit. */
  [Symbol.dispose](): void;

  /** Reactive, seq-ordered window; mutations (retractions) applied in place. */
  readonly messages: readonly Message<M>[];
  send(input: SendInput<M>): Promise<SendAck>;

  /** Older history, backwards only. */
  loadPrevious(): Promise<boolean>;
  readonly isLoadingPrevious: boolean;
  /**
   * Starts `true` (optimistic — including under `history: "none"`, before any page is
   * fetched); flips to `false` once `loadPrevious` reaches the beginning of the channel.
   */
  readonly hasPrevious: boolean;

  /** Filtered lens over the same store — one socket, N views. */
  view(where: MessageWhere<M>): ChannelView<M>;

  readonly presence: DetailedPresence | AggregatePresence | undefined;

  /** Transient per-user activity, never self. */
  readonly activity: readonly ActivityEntry[];
  /** "typing", "thinking", "uploading", …; SDK throttles; NO-OP on broadcast channels. */
  sendActivity(kind: string): void;
  /** Sugar: activity filtered to kind "typing". */
  readonly typing: readonly string[];
  /** Sugar: sendActivity("typing"). */
  sendTyping(): void;

  readonly unread: number;
  /** Advances the CHANNEL watermark (independent of inbox read state). */
  markAsRead(): void;

  /** From the connect snapshot. */
  readonly info: ChannelInfo | undefined;
  /** Own verified claims, post-connect. */
  readonly me: { id: string; anon: boolean; claims: Record<string, unknown> } | undefined;
  /** Standard channels: fetched directory (incl. offline), `online` merged. Not live state. */
  members(): Promise<MemberRow[]>;
  /**
   * Replace own presence metadata mid-session; sends the full replacement bag upstream
   * and the server re-announces it via presence deltas. Presentation only — never authz.
   */
  setMetadata(metadata: Record<string, unknown>): void;

  readonly status: ChannelStatus;
  on<E extends keyof ChannelEvents<M>>(event: E, fn: ChannelEvents<M>[E]): Unsubscribe;

  /** useSyncExternalStore-shaped store contract. */
  subscribe(listener: () => void): Unsubscribe;
  getSnapshot(): ChannelSnapshot<M>;
}

/** A filtered lens over a channel's store (§6). */
export interface ChannelView<M = unknown> {
  readonly messages: readonly Message<M>[];
  readonly unread: number;
  on<E extends keyof ChannelEvents<M>>(event: E, fn: ChannelEvents<M>[E]): Unsubscribe;
  subscribe(listener: () => void): Unsubscribe;
  getSnapshot(): { messages: readonly Message<M>[]; unread: number };
}

// ── Inbox (§5) ──────────────────────────────────────────────

export interface InboxEntry {
  id: string;
  name?: string;
  meta?: Record<string, unknown>;
  /** Absent on >100-member channels (seq-only tier). */
  latest?: { text: string; sender: { id: string }; at: number };
  /** latestSeq − my watermark. */
  unread: number;
  /**
   * Durable per-user-per-channel preference. Muting silences aggregation, not data: the
   * entry keeps updating and stops contributing to `counter`, but items addressed to you
   * still count and still land.
   */
  muted: boolean;
  /** Recency (sort key). */
  at: number;
  /**
   * Advances the INBOX position for this channel only — clears the sidebar badge. Fully
   * independent of the channel's own watermark.
   */
  markAsRead(): void;
  mute(): void;
  unmute(): void;
}

export interface InboxEntries extends ReadonlyArray<InboxEntry> {
  /** ALWAYS hits the full registry, ignoring any view filter. */
  get(id: string): InboxEntry | undefined;
}

export interface InboxItem<D = unknown> {
  /** Event ID (idempotency key). */
  id: string;
  /** Userland: "mention" | "ticket.assigned" | … */
  type: string;
  title?: string;
  data: D;
  /** Present when channel-originated (mention, to-send). */
  channelId?: string;
  at: number;
  /** PER-ITEM read state (not a watermark). */
  read: boolean;
  /** Flips THIS item only — never cascades to older items. */
  markAsRead(): void;
}

export interface InboxEvents {
  item: (item: InboxItem) => void;
  change: () => void;
}

export interface InboxSnapshot {
  channels: InboxEntries;
  items: readonly InboxItem[];
  counter: number;
  status: InboxStatus;
}

/**
 * `"idle"` is never produced by a live {@link InboxHandle} — a real inbox is always at least
 * `"connecting"` from the moment it's created (`portal.inbox()` connects immediately). It
 * exists for consumers that model a handle that hasn't been created yet at all, e.g.
 * `@portalsdk/react`'s SSR-inert `useInbox` result.
 */
export type InboxStatus = "idle" | "connecting" | "ready" | "reconnecting";

export interface InboxView<D = unknown> {
  readonly channels: InboxEntries;
  readonly items: readonly InboxItem<D>[];
  /** Unseen items within THIS view's filter. */
  readonly unseen: number;
  on<E extends keyof InboxEvents>(event: E, fn: InboxEvents[E]): Unsubscribe;
  subscribe(listener: () => void): Unsubscribe;
  getSnapshot(): { channels: InboxEntries; items: readonly InboxItem<D>[]; unseen: number };
}

export interface InboxHandle {
  /** Recency-sorted. .get(id) ALWAYS hits the full registry, ignoring any view filter. */
  readonly channels: InboxEntries;
  /** Targeted items: mentions, to-sends, notify descriptors, users.notify. */
  readonly items: readonly InboxItem[];
  /**
   * Global badge: Σ channel unreads + unseen items. Muted entries excluded — EXCEPT items
   * addressed to you (a mention in a muted room still badges).
   */
  readonly counter: number;
  view<D = unknown>(query: InboxQuery<D>): InboxView<D>;
  /** Global, zero-arg: marks ALL items read. Scoped clearing = iterate a view. */
  markAllRead(): void;
  readonly status: InboxStatus;
  on<E extends keyof InboxEvents>(event: E, fn: InboxEvents[E]): Unsubscribe;
  subscribe(listener: () => void): Unsubscribe;
  getSnapshot(): InboxSnapshot;
}
