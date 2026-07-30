import type {
  ActivityEntry,
  AggregatePresence,
  ChannelInfo,
  ChannelStatus,
  DetailedPresence,
  InboxEntries,
  InboxItem,
  InboxQuery,
  InboxStatus,
  Message,
  MessageWhere,
  PortalError,
  SendAck,
  SendInput,
} from "@portalsdk/core";

/** Verified identity of the connected user, once the channel is ready. */
export type Me = { id: string; anon: boolean; claims: Record<string, unknown> };

export interface UseChannelParams<M = unknown> {
  /**
   * `undefined` = not mounted (the two-pane "nothing selected" pattern): the hook renders
   * inert and opens no connection. A change of id releases the old handle and acquires the new.
   */
  channelId: string | undefined;
  /**
   * When the channel watermark auto-advances. Default `"mount"`. `"visible"` advances on
   * mount if the document is visible, then on each `visibilitychange` → visible while mounted
   * (no debounce in v1). `"manual"` never auto-advances — call `markAsRead()` yourself.
   */
  readOn?: "mount" | "visible" | "manual";
  /** Initial backfill on connect; default 50; `"none"` = live-only. */
  history?: number | "none";
  /** Initial presence metadata for this session. */
  metadata?: Record<string, unknown>;
  /** Reserved surface: typed, rejected at runtime in v1 (NotYetSupportedError). */
  where?: MessageWhere<M>;
  onMention?: (msg: Message<M>) => void;
  /** Fires on every message delivered to this channel, persistent or ephemeral. */
  onMessage?: (msg: Message<M>) => void;
  onError?: (err: PortalError) => void;
}

export interface UseChannelResult<M = unknown> {
  messages: readonly Message<M>[];
  send: (input: SendInput<M>) => Promise<SendAck>;
  loadPrevious: () => Promise<boolean>;
  isLoadingPrevious: boolean;
  hasPrevious: boolean;
  channel: ChannelInfo | undefined;
  me: Me | undefined;
  presence: DetailedPresence | AggregatePresence | undefined;
  activity: readonly ActivityEntry[];
  sendActivity: (kind: string) => void;
  /** Sugar over `activity`, kind "typing". */
  typing: readonly string[];
  sendTyping: () => void;
  unread: number;
  markAsRead: () => void;
  /**
   * Replace own presence metadata mid-session. Pass-through to the channel handle's
   * `setMetadata`; a no-op while inert (no channel selected, or during server rendering).
   */
  setMetadata: (metadata: Record<string, unknown>) => void;
  status: ChannelStatus;
}

export interface UseInboxParams<D = unknown> extends InboxQuery<D> {
  /**
   * Fires once per item arriving after mount — never for the ready/backlog snapshot, and
   * never twice for the same id (redelivery is deduped, following core's own item-id
   * idempotency). A new inline callback each render does not drop or duplicate events.
   */
  onItem?: (item: InboxItem<D>) => void;
}

export interface UseInboxResult<D = unknown> {
  channels: InboxEntries;
  items: readonly InboxItem<D>[];
  /** Global (ignores this view's filter). */
  counter: number;
  /** Unseen items within THIS view's filter. */
  unseen: number;
  /** Global, zero-arg. */
  markAllRead: () => void;
  status: InboxStatus;
}
