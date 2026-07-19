import type {
  ActivityFrame,
  BatchFrame,
  ChannelClientFrame,
  ChannelReadyFrame,
  ChannelServerFrame,
  Capabilities,
  ChannelInfo,
  DirectFrame,
  ErrorFrame,
  MeInfo,
  PongFrame,
  PresenceFrame,
  ReadyPresence,
  ReassignFrame,
  RetractFrame,
  WirePresenceParticipant,
} from "./channel.js";
import type {
  InboxClientFrame,
  InboxCounterFrame,
  InboxEntryFrame,
  InboxEntryWire,
  InboxItemFrame,
  InboxItemWire,
  InboxReadyFrame,
  InboxServerFrame,
} from "./inbox.js";
import type {
  AnyFrame,
  ParsedChannelClientFrame,
  ParsedChannelFrame,
  ParsedInboxClientFrame,
  ParsedInboxFrame,
  UnknownFrame,
} from "./frames.js";
import type { Mention, WireMessage, WireSender } from "./message.js";

// ============================================================
// Primitives
// ============================================================

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isStr = (v: unknown): v is string => typeof v === "string";
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

/** JSON has no NaN/Infinity, so any non-finite number means a hand-built object. */
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** An absent optional field is valid; a present one must match. */
const opt = <T>(v: unknown, check: (x: unknown) => x is T): boolean =>
  v === undefined || check(v);

const arrayOf = <T>(v: unknown, check: (x: unknown) => x is T): v is T[] =>
  Array.isArray(v) && v.every(check);

const isStrRec = (v: unknown): v is Record<string, string> =>
  isRec(v) && Object.values(v).every(isStr);

// ============================================================
// Shape validators
//
// Each validator checks exactly the fields its type declares required — no more, no
// less. Unknown fields are ignored and survive untouched (§6), but a frame missing a
// required field is rejected rather than returned as a type that lies about it.
// ============================================================

const isMention = (v: unknown): v is Mention => isRec(v) && isStr(v["userId"]);

const isWireSender = (v: unknown): v is WireSender =>
  isRec(v) && isStr(v["id"]) && isBool(v["anon"]) && opt(v["username"], isStr);

const isWireMessage = (v: unknown): v is WireMessage =>
  isRec(v) &&
  isStr(v["id"]) &&
  (v["seq"] === null || isNum(v["seq"])) &&
  isStr(v["type"]) &&
  isStr(v["kind"]) &&
  "content" in v &&
  isWireSender(v["sender"]) &&
  isNum(v["timestamp"]) &&
  opt(v["to"], isStr) &&
  (v["mentions"] === undefined || arrayOf(v["mentions"], isMention)) &&
  isBool(v["retracted"]) &&
  isBool(v["ephemeral"]);

const isChannelInfo = (v: unknown): v is ChannelInfo =>
  isRec(v) &&
  isStr(v["id"]) &&
  (v["mode"] === "standard" || v["mode"] === "broadcast") &&
  opt(v["name"], isStr) &&
  opt(v["meta"], isRec);

const isCapabilities = (v: unknown): v is Capabilities =>
  isRec(v) && opt(v["publish"], isBool) && opt(v["sendDirect"], isBool);

const isMeInfo = (v: unknown): v is MeInfo =>
  isRec(v) &&
  isStr(v["id"]) &&
  isBool(v["anon"]) &&
  isRec(v["claims"]) &&
  isCapabilities(v["capabilities"]);

const isParticipant = (v: unknown): v is WirePresenceParticipant =>
  isRec(v) &&
  isStr(v["id"]) &&
  isBool(v["anon"]) &&
  opt(v["username"], isStr) &&
  opt(v["metadata"], isRec);

const isReadyPresence = (v: unknown): v is ReadyPresence => {
  if (!isRec(v)) return false;
  if (v["mode"] === "detailed") {
    return arrayOf(v["participants"], isParticipant) && isNum(v["count"]);
  }
  if (v["mode"] === "aggregate") {
    return isNum(v["count"]) && (v["recent"] === undefined || Array.isArray(v["recent"]));
  }
  return false;
};

const isInboxEntryWire = (v: unknown): v is InboxEntryWire =>
  isRec(v) &&
  isStr(v["id"]) &&
  opt(v["name"], isStr) &&
  opt(v["meta"], isRec) &&
  opt(v["latest"], isLatest) &&
  isNum(v["unread"]) &&
  isBool(v["muted"]) &&
  isNum(v["at"]);

const isLatest = (v: unknown): v is InboxEntryWire["latest"] =>
  isRec(v) &&
  isStr(v["text"]) &&
  isRec(v["sender"]) &&
  isStr((v["sender"] as Rec)["id"]) &&
  isNum(v["at"]);

const isInboxItemWire = (v: unknown): v is InboxItemWire =>
  isRec(v) &&
  isStr(v["id"]) &&
  isStr(v["type"]) &&
  opt(v["title"], isStr) &&
  "data" in v &&
  opt(v["channelId"], isStr) &&
  isNum(v["at"]) &&
  isBool(v["read"]);

// ============================================================
// Frame tables — the single source of truth for "known `t`"
// ============================================================

type Validator = (v: Rec) => boolean;

const CHANNEL_SERVER_FRAMES: Record<ChannelServerFrame["t"], Validator> = {
  ready: (v) =>
    isChannelInfo(v["channel"]) &&
    isMeInfo(v["me"]) &&
    isNum(v["seq"]) &&
    isStr(v["leaf"]) &&
    isReadyPresence(v["presence"]) &&
    opt(v["watermark"], isNum) &&
    opt(v["ext"], isRec) &&
    opt(v["bindings"], isStrRec),
  batch: (v) => arrayOf(v["msgs"], isWireMessage),
  retract: (v) => isStr(v["id"]) && isNum(v["seq"]) && opt(v["reason"], isStr),
  presence: (v) => {
    if (v["mode"] === "detailed") {
      return (
        arrayOf(v["joined"], isParticipant) &&
        arrayOf(v["left"], isStr) &&
        isNum(v["count"])
      );
    }
    if (v["mode"] === "aggregate") {
      return isNum(v["count"]) && Array.isArray(v["recent"]);
    }
    return false;
  },
  activity: (v) => isStr(v["userId"]) && isStr(v["kind"]) && isNum(v["since"]),
  direct: (v) => isWireMessage(v["msg"]),
  reassign: (v) => isStr(v["leaf"]),
  error: (v) => isStr(v["code"]) && opt(v["reason"], isStr) && opt(v["ref"], isStr),
  pong: () => true,
};

const INBOX_SERVER_FRAMES: Record<InboxServerFrame["t"], Validator> = {
  ready: (v) =>
    arrayOf(v["entries"], isInboxEntryWire) &&
    arrayOf(v["items"], isInboxItemWire) &&
    isNum(v["counter"]),
  entry: (v) => isInboxEntryWire(v["entry"]),
  item: (v) => isInboxItemWire(v["item"]),
  counter: (v) => isNum(v["n"]),
  pong: () => true,
};

// C→S tables. A server (or the test mock) receives these; the same totality contract
// applies as for the S→C tables. `ping` and `activity` also appear in S→C sets with
// different shapes — the families are disjoint, so each is validated against its own
// direction's table.
const CHANNEL_CLIENT_FRAMES: Record<ChannelClientFrame["t"], Validator> = {
  ephemeral: (v) => isStr(v["cl"]) && isStr(v["type"]) && "content" in v,
  activity: (v) => isStr(v["kind"]),
  watermark: (v) => isNum(v["seq"]),
  meta: (v) => isRec(v["metadata"]),
  ping: () => true,
};

const INBOX_CLIENT_FRAMES: Record<InboxClientFrame["t"], Validator> = {
  read: (v) => isStr(v["channelId"]),
  "item.read": (v) => isStr(v["id"]),
  "read.all": () => true,
  mute: (v) => isStr(v["channelId"]) && isBool(v["muted"]),
  ping: () => true,
};

const validatorFor = <T extends string>(
  table: Record<T, Validator>,
  t: string,
): Validator | undefined =>
  Object.hasOwn(table, t) ? table[t as T] : undefined;

// ============================================================
// Parse / serialize
// ============================================================

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * A frame-shaped value: an object carrying a string `t`. Anything else is not a frame.
 */
const asFrameShape = (raw: string): (Rec & { t: string }) | null => {
  const value = parseJson(raw);
  if (!isRec(value) || !isStr(value["t"])) return null;
  return value as Rec & { t: string };
};

/**
 * Parse a text frame from a **channel** socket (S→C).
 *
 * Total and non-throwing:
 * - malformed JSON, a non-object, or a missing/non-string `t` → `null`
 * - a known `t` whose shape does not match → `null`
 * - an unknown `t` → the frame is returned intact as an {@link UnknownFrame} (§6),
 *   because forward compatibility says ignore it, not lose it
 *
 * Unknown *fields* on known frames are preserved, so `parse` → {@link serializeFrame}
 * round-trips without dropping anything.
 */
export function parseChannelFrame(raw: string): ParsedChannelFrame | null {
  const frame = asFrameShape(raw);
  if (frame === null) return null;

  const validate = validatorFor(CHANNEL_SERVER_FRAMES, frame.t);
  if (validate === undefined) return frame as UnknownFrame;

  return validate(frame) ? (frame as ChannelServerFrame) : null;
}

/**
 * Parse a text frame from an **inbox** socket (S→C).
 *
 * Same contract as {@link parseChannelFrame}. The two families are disjoint: an inbox
 * `ready` and a channel `ready` share a `t` but not a shape, so a frame must be parsed
 * with the function matching the socket it arrived on.
 */
export function parseInboxFrame(raw: string): ParsedInboxFrame | null {
  const frame = asFrameShape(raw);
  if (frame === null) return null;

  const validate = validatorFor(INBOX_SERVER_FRAMES, frame.t);
  if (validate === undefined) return frame as UnknownFrame;

  return validate(frame) ? (frame as InboxServerFrame) : null;
}

/**
 * Parse a text frame a client sent on a **channel** socket (C→S).
 *
 * The upstream counterpart of {@link parseChannelFrame}, for a server or test mock
 * receiving the frames a client sends. Same totality contract: `null` on malformed JSON
 * / missing `t` / a known `t` with a bad shape, and an {@link UnknownFrame} passthrough
 * for an unrecognised `t` (§6).
 */
export function parseChannelClientFrame(
  raw: string,
): ParsedChannelClientFrame | null {
  const frame = asFrameShape(raw);
  if (frame === null) return null;

  const validate = validatorFor(CHANNEL_CLIENT_FRAMES, frame.t);
  if (validate === undefined) return frame as UnknownFrame;

  return validate(frame) ? (frame as ChannelClientFrame) : null;
}

/**
 * Parse a text frame a client sent on an **inbox** socket (C→S).
 *
 * Same contract as {@link parseChannelClientFrame}.
 */
export function parseInboxClientFrame(raw: string): ParsedInboxClientFrame | null {
  const frame = asFrameShape(raw);
  if (frame === null) return null;

  const validate = validatorFor(INBOX_CLIENT_FRAMES, frame.t);
  if (validate === undefined) return frame as UnknownFrame;

  return validate(frame) ? (frame as InboxClientFrame) : null;
}

/**
 * Serialize a frame to a JSON text frame.
 *
 * Primarily for C→S sends. It accepts any frame so that a parsed S→C frame can be
 * re-serialized intact — the round-trip that proves unknown fields survive (§6).
 */
export function serializeFrame(frame: AnyFrame): string {
  return JSON.stringify(frame);
}

// ============================================================
// Guards
//
// These narrow a frame that has already been through parseChannelFrame /
// parseInboxFrame, which is what makes a `t` check sufficient: the parser has already
// validated the shape, so narrowing on the discriminator cannot lie.
// ============================================================

/** True when the parser recognised this channel frame — i.e. it is not an `UnknownFrame`. */
export const isKnownChannelFrame = (
  frame: ParsedChannelFrame,
): frame is ChannelServerFrame => Object.hasOwn(CHANNEL_SERVER_FRAMES, frame.t);

/** True when the parser recognised this inbox frame — i.e. it is not an `UnknownFrame`. */
export const isKnownInboxFrame = (
  frame: ParsedInboxFrame,
): frame is InboxServerFrame => Object.hasOwn(INBOX_SERVER_FRAMES, frame.t);

/** True when the parser recognised this C→S channel frame (not an `UnknownFrame`). */
export const isKnownChannelClientFrame = (
  frame: ParsedChannelClientFrame,
): frame is ChannelClientFrame => Object.hasOwn(CHANNEL_CLIENT_FRAMES, frame.t);

/** True when the parser recognised this C→S inbox frame (not an `UnknownFrame`). */
export const isKnownInboxClientFrame = (
  frame: ParsedInboxClientFrame,
): frame is InboxClientFrame => Object.hasOwn(INBOX_CLIENT_FRAMES, frame.t);

// ── Channel S→C ─────────────────────────────────────────────

export const isChannelReady = (f: ParsedChannelFrame): f is ChannelReadyFrame =>
  f.t === "ready";
export const isBatch = (f: ParsedChannelFrame): f is BatchFrame => f.t === "batch";
export const isRetract = (f: ParsedChannelFrame): f is RetractFrame =>
  f.t === "retract";
export const isPresence = (f: ParsedChannelFrame): f is PresenceFrame =>
  f.t === "presence";
export const isActivity = (f: ParsedChannelFrame): f is ActivityFrame =>
  f.t === "activity";
export const isDirect = (f: ParsedChannelFrame): f is DirectFrame => f.t === "direct";
export const isReassign = (f: ParsedChannelFrame): f is ReassignFrame =>
  f.t === "reassign";
export const isError = (f: ParsedChannelFrame): f is ErrorFrame => f.t === "error";
export const isPong = (f: ParsedChannelFrame): f is PongFrame => f.t === "pong";

// ── Inbox S→C ───────────────────────────────────────────────

export const isInboxReady = (f: ParsedInboxFrame): f is InboxReadyFrame =>
  f.t === "ready";
export const isInboxEntry = (f: ParsedInboxFrame): f is InboxEntryFrame =>
  f.t === "entry";
export const isInboxItem = (f: ParsedInboxFrame): f is InboxItemFrame =>
  f.t === "item";
export const isInboxCounter = (f: ParsedInboxFrame): f is InboxCounterFrame =>
  f.t === "counter";
export const isInboxPong = (f: ParsedInboxFrame): f is PongFrame => f.t === "pong";
