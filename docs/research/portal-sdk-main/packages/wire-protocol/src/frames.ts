import type { ChannelClientFrame, ChannelServerFrame } from "./channel.js";
import type { InboxClientFrame, InboxServerFrame } from "./inbox.js";

/**
 * A well-formed frame whose `t` this version does not know (§6).
 *
 * v1 evolves additively: the platform may introduce new frame types, and an older
 * client MUST ignore them. Ignorable is not the same as droppable — the parser hands
 * the frame back intact so it survives a parse → serialize round-trip and can be
 * logged, forwarded, or inspected rather than silently vanishing.
 */
export type UnknownFrame = {
  t: string;
  [field: string]: unknown;
};

/**
 * What {@link parseChannelFrame} yields: a known S→C channel frame, or an
 * {@link UnknownFrame} passthrough.
 */
export type ParsedChannelFrame = ChannelServerFrame | UnknownFrame;

/**
 * What {@link parseInboxFrame} yields: a known S→C inbox frame, or an
 * {@link UnknownFrame} passthrough.
 */
export type ParsedInboxFrame = InboxServerFrame | UnknownFrame;

/**
 * What {@link parseChannelClientFrame} yields: a known C→S channel frame, or an
 * {@link UnknownFrame} passthrough. Used by a server (or mock) receiving upstream frames.
 */
export type ParsedChannelClientFrame = ChannelClientFrame | UnknownFrame;

/**
 * What {@link parseInboxClientFrame} yields: a known C→S inbox frame, or an
 * {@link UnknownFrame} passthrough.
 */
export type ParsedInboxClientFrame = InboxClientFrame | UnknownFrame;

/** Any frame this package can represent, either direction, either socket family. */
export type AnyFrame =
  | ChannelServerFrame
  | ChannelClientFrame
  | InboxServerFrame
  | InboxClientFrame
  | UnknownFrame;
