/**
 * `@portalsdk/core` — the framework-agnostic Portal client.
 *
 * The public surface is the client SDK contract: the {@link Portal} class, the error
 * hierarchy, and the observable types. Transport concerns (`seq`, frames, reconnect
 * tokens, `partysocket`) live below this edge and are never exported.
 */

export { Portal } from "./portal.js";

export {
  PortalError,
  InvalidApiKeyError,
  BlockedError,
  TokenExpiredError,
  NotMemberError,
  ChannelAtCapacityError,
  AnonymousNotAllowedError,
  NotYetSupportedError,
  DegradedError,
} from "./errors.js";

// Explicit type surface — the client SDK contract (§1–8), and nothing beyond it. Types
// referenced only by method signatures (ChannelSnapshot/ChannelView/InboxSnapshot/InboxView
// — the return types of getSnapshot()/view()) are exported so those signatures are usable.
// `InboxStatus` and `Scalar` stay internal: the contract inlines them.
export type {
  Unsubscribe,
  PortalConfig,
  ChannelOptions,
  Envelope,
  Message,
  SendInput,
  PersistentSend,
  EphemeralSend,
  SendAck,
  Op,
  Where,
  Filterable,
  MessageWhere,
  InboxWhere,
  InboxQuery,
  DetailedPresence,
  AggregatePresence,
  ChannelStatus,
  ActivityEntry,
  ChannelInfo,
  MemberRow,
  ChannelEvents,
  ChannelSnapshot,
  ChannelHandle,
  ChannelView,
  InboxEntry,
  InboxEntries,
  InboxItem,
  InboxEvents,
  InboxSnapshot,
  InboxView,
  InboxHandle,
} from "./types.js";
