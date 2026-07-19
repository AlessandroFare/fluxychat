import type {
  ActivityEntry,
  AggregatePresence,
  ChannelInfo,
  ChannelStatus,
  DetailedPresence,
  InboxEntries,
  InboxItem,
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
  status: ChannelStatus;
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
  status: "connecting" | "ready" | "reconnecting";
}
