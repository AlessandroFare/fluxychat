import type { SendAckWire, WireMessage } from "@portalsdk/wire-protocol";

import type { Message } from "./types.js";

/** An unacked local send, held until the edge accepts or rejects it. */
interface OptimisticMessage {
  /** Client tag; the public id until the ack supplies the platform id. */
  tempId: string;
  type: string;
  content: unknown;
  to: string | undefined;
  mentions: { userId: string }[] | undefined;
  timestamp: number;
  status: "pending" | "failed";
}

/** Who "I" am, for stamping optimistic messages before the ack arrives. */
interface Me {
  id: string;
  anon: boolean;
}

/**
 * The per-channel message window: ordering, dedup, gap detection, retraction, and the
 * optimistic-send lifecycle. Pure and synchronous — the connection drives it and performs
 * the I/O (HTTP range fetches, publishes) that its outputs call for.
 *
 * Persistent messages are keyed by `seq` (the dedup key) and always rendered in seq order.
 * `seq` never escapes into the public {@link Message}. Ephemeral messages (no seq) are not
 * stored — they are handed back for event dispatch only.
 */
export class MessageBuffer {
  readonly #channelId: string;
  readonly #persistent = new Map<number, WireMessage>();
  /** Seqs whose retraction outran the message; applied when the message arrives. */
  readonly #pendingRetracts = new Set<number>();
  readonly #optimistic: OptimisticMessage[] = [];

  #me: Me | undefined;
  /**
   * Highest seq held with no gap below it — the `last=` value and gap-fill anchor. Seeded
   * from the `ready` head; the live stream begins at `contiguous + 1`.
   */
  #contiguous: number | undefined;
  /** Latest seq known for the channel (the head), independent of what is loaded. */
  #head: number | undefined;
  /** My read position; `unread` counts what lies beyond it. */
  #watermark: number | undefined;
  #hasPrevious = true;

  constructor(channelId: string) {
    this.#channelId = channelId;
  }

  setMe(id: string, anon: boolean): void {
    this.#me = { id, anon };
  }

  /** Anchor the live stream and gap baseline to a `ready` snapshot's head. */
  setBaseline(seq: number): void {
    this.#raiseHead(seq);
    if (this.#contiguous === undefined || seq > this.#contiguous) {
      this.#contiguous = seq;
      this.#advanceContiguous();
    }
  }

  /** Set my read position (from `ready.watermark`, or advanced by `markAsRead`). */
  setWatermark(seq: number): void {
    this.#watermark = seq;
  }

  /** The head seq — what `markAsRead` advances the watermark to. */
  headSeq(): number | undefined {
    return this.#head;
  }

  /** Count of unread messages: how far the head runs beyond the watermark. */
  channelUnread(): number {
    if (this.#head === undefined || this.#watermark === undefined) return 0;
    return Math.max(0, this.#head - this.#watermark);
  }

  /** The `last=` reconnect value: highest contiguous seq held (or the baseline). */
  contiguousSeq(): number | undefined {
    return this.#contiguous;
  }

  /** Lowest seq held — the `before=` cursor for the next older page. */
  lowestSeq(): number | undefined {
    let lowest: number | undefined;
    for (const seq of this.#persistent.keys()) {
      if (lowest === undefined || seq < lowest) lowest = seq;
    }
    return lowest;
  }

  hasPrevious(): boolean {
    return this.#hasPrevious;
  }

  setHasPrevious(value: boolean): void {
    this.#hasPrevious = value;
  }

  /**
   * Ingest delivered messages (a `batch` or a `direct`). Persistent ones are stored and
   * deduped, and the newly-stored ones are returned in public form for `message`/`mention`
   * dispatch. Also reports the missing seq ranges a gap opened, for the caller to
   * range-fetch.
   *
   * SPEC: incoming ephemeral messages (no seq) are not modeled — the contract does not
   * place them in the ordered window or bind them to a channel event, so they are dropped
   * here rather than guessed at.
   */
  ingest(msgs: readonly WireMessage[]): {
    delivered: Message[];
    gaps: [number, number][];
  } {
    const delivered: Message[] = [];
    for (const msg of msgs) {
      if (msg.seq === null || msg.ephemeral) continue;
      const stored = this.#store(msg);
      if (stored !== undefined) delivered.push(this.#toPublic(stored));
    }
    this.#advanceContiguous();
    return { delivered, gaps: this.#gaps() };
  }

  /** Ingest an older page or a gap-fill range; never opens a gap. */
  ingestHistory(msgs: readonly WireMessage[]): void {
    for (const msg of msgs) {
      if (msg.seq === null) continue;
      this.#store(msg);
    }
    this.#advanceContiguous();
  }

  /** Apply a retraction, or remember it if its message has not arrived yet. */
  retract(seq: number): void {
    const held = this.#persistent.get(seq);
    if (held === undefined) {
      this.#pendingRetracts.add(seq);
      return;
    }
    this.#persistent.set(seq, this.#tombstone(held));
  }

  addOptimistic(message: Omit<OptimisticMessage, "status">): void {
    this.#optimistic.push({ ...message, status: "pending" });
  }

  /** Reconcile an accepted send: drop the optimistic entry, store the durable message. */
  ack(tempId: string, ack: SendAckWire): void {
    const index = this.#optimistic.findIndex((o) => o.tempId === tempId);
    if (index === -1) return;
    const [optimistic] = this.#optimistic.splice(index, 1);
    if (optimistic === undefined || this.#me === undefined) return;
    const wire: WireMessage = {
      id: ack.id,
      seq: ack.seq,
      type: optimistic.type,
      kind: "text",
      content: optimistic.content,
      sender: { id: this.#me.id, anon: this.#me.anon },
      timestamp: ack.timestamp,
      ...(optimistic.to !== undefined ? { to: optimistic.to } : {}),
      ...(optimistic.mentions !== undefined ? { mentions: optimistic.mentions } : {}),
      retracted: false,
      ephemeral: false,
    };
    this.#store(wire);
    this.#advanceContiguous();
    // Posting advances my own read position, exactly as the server does atomically on the
    // write (§5): my own message must never count as unread to me, on any device.
    if (this.#watermark === undefined || ack.seq > this.#watermark) {
      this.#watermark = ack.seq;
    }
  }

  /** Roll an optimistic send back out of the window (a rejected publish). */
  rollback(tempId: string): void {
    const index = this.#optimistic.findIndex((o) => o.tempId === tempId);
    if (index !== -1) this.#optimistic.splice(index, 1);
  }

  /** Drop all state (a teardown). */
  reset(): void {
    this.#persistent.clear();
    this.#pendingRetracts.clear();
    this.#optimistic.length = 0;
    this.#me = undefined;
    this.#contiguous = undefined;
    this.#head = undefined;
    this.#watermark = undefined;
    this.#hasPrevious = true;
  }

  /** The public, seq-ordered window with unacked sends appended. */
  messages(): Message[] {
    const sorted = [...this.#persistent.keys()].sort((a, b) => a - b);
    const out: Message[] = sorted.map((seq) =>
      this.#toPublic(this.#persistent.get(seq) as WireMessage),
    );
    for (const optimistic of this.#optimistic) out.push(this.#optimisticToPublic(optimistic));
    return out;
  }

  // ── Internals ─────────────────────────────────────────────

  /** Store a persistent message, returning the stored form, or undefined if it was a dup. */
  #store(msg: WireMessage): WireMessage | undefined {
    const seq = msg.seq as number;
    if (this.#persistent.has(seq)) return undefined; // dedup: retries/replays
    const stored = this.#pendingRetracts.has(seq) ? this.#tombstone(msg) : msg;
    this.#pendingRetracts.delete(seq);
    this.#persistent.set(seq, stored);
    this.#raiseHead(seq);
    return stored;
  }

  #raiseHead(seq: number): void {
    if (this.#head === undefined || seq > this.#head) this.#head = seq;
  }

  #tombstone(msg: WireMessage): WireMessage {
    return { ...msg, retracted: true, content: null };
  }

  #advanceContiguous(): void {
    if (this.#contiguous === undefined) return;
    while (this.#persistent.has(this.#contiguous + 1)) this.#contiguous++;
  }

  /** Maximal runs of missing seqs above the contiguous head (live gaps only). */
  #gaps(): [number, number][] {
    if (this.#contiguous === undefined) return [];
    let maxHeld = this.#contiguous;
    for (const seq of this.#persistent.keys()) if (seq > maxHeld) maxHeld = seq;

    const ranges: [number, number][] = [];
    let start: number | undefined;
    for (let seq = this.#contiguous + 1; seq <= maxHeld; seq++) {
      if (!this.#persistent.has(seq)) {
        if (start === undefined) start = seq;
      } else if (start !== undefined) {
        ranges.push([start, seq - 1]);
        start = undefined;
      }
    }
    return ranges;
  }

  #toPublic(wire: WireMessage): Message {
    return {
      id: wire.id,
      channelId: this.#channelId,
      type: wire.type,
      kind: "text",
      content: wire.content,
      sender: wire.sender,
      timestamp: wire.timestamp,
      ...(wire.to !== undefined ? { to: wire.to } : {}),
      ...(wire.mentions !== undefined ? { mentions: wire.mentions } : {}),
      retracted: wire.retracted,
      ephemeral: wire.ephemeral,
      unread: this.#isUnread(wire.seq),
      status: "sent",
    };
  }

  /** A persistent message is unread when its seq lies beyond my watermark. */
  #isUnread(seq: number | null): boolean {
    return seq !== null && this.#watermark !== undefined && seq > this.#watermark;
  }

  #optimisticToPublic(optimistic: OptimisticMessage): Message {
    const sender = this.#me ?? { id: "", anon: false };
    return {
      id: optimistic.tempId,
      channelId: this.#channelId,
      type: optimistic.type,
      kind: "text",
      content: optimistic.content,
      sender: { id: sender.id, anon: sender.anon },
      timestamp: optimistic.timestamp,
      ...(optimistic.to !== undefined ? { to: optimistic.to } : {}),
      ...(optimistic.mentions !== undefined ? { mentions: optimistic.mentions } : {}),
      retracted: false,
      ephemeral: false,
      unread: false,
      status: optimistic.status,
    };
  }
}
