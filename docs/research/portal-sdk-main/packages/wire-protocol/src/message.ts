/** A mention as declared by the sender and verified by the platform (§2.1). */
export type Mention = {
  userId: string;
};

/** Who sent a {@link WireMessage} (§2.1). */
export type WireSender = {
  id: string;
  anon: boolean;
  /**
   * Populated on broadcast channels only — they have no roster to join against.
   * On standard channels display data is joined app-side by `id`.
   */
  username?: string;
};

/**
 * The message envelope as it travels on the wire (§2.1).
 *
 * This is the transport form, one layer BELOW the SDK's public `Message`. Notably it
 * keeps `seq`: ordering, dedup, and gap-fill are expressed in terms of it. Stripping
 * `seq` and deriving `unread`/`status` is the client runtime's job, not this package's.
 */
export type WireMessage = {
  /** Platform-assigned. The dedup and mutation key. */
  id: string;
  /**
   * Per-channel, assigned at persist; contiguous within a connection's delivery stream.
   *
   * `null` for ephemeral messages, which are not persisted and carry no ordering or
   * gap guarantees (§4).
   */
  seq: number | null;
  /** Userland discriminator; defaults to `"message"`. Opaque to the platform. */
  type: string;
  /**
   * Envelope content class; `"text"` throughout v1. Media kinds are reserved and will
   * not appear in v1 (§7).
   *
   * SPEC: §2.1 shows `"kind": "text"` by example but never enumerates the field, so
   * this is `string` rather than a closed union — a future kind must not cause a v1
   * parser to drop the frame (§6 forward compatibility).
   */
  kind: string;
  /** Customer payload, ≤2KB. Opaque to the platform and to this package. */
  content: unknown;
  sender: WireSender;
  /** Epoch milliseconds. */
  timestamp: number;
  /** Targeted-delivery recipient; the message skips fan-out (§2.1). */
  to?: string;
  mentions?: Mention[];
  /** Flips in place via a `retract` frame; content is stripped per policy. */
  retracted: boolean;
  /** Ephemeral messages are not persisted and have `seq: null`. */
  ephemeral: boolean;
};
