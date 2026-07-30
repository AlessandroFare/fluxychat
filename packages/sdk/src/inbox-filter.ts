export interface FluxyWhereOp<V> {
  eq?: V | V[];
  neq?: V | V[];
  in?: V[];
  gt?: V;
  lt?: V;
}

export type FluxyWhere<F extends object> = {
  [K in keyof F]?: FluxyWhereOp<F[K] extends string | number | boolean ? F[K] : never>;
};

export interface FluxyInboxItemFields {
  roomId: string;
  roomName: string;
  roomType?: string;
  unreadCount: number;
  snoozedUntil?: string | null;
}

export type FluxyInboxWhere = FluxyWhere<FluxyInboxItemFields>;

export interface FluxyInboxQuery {
  /** Scope to one room (applied before `where`). */
  roomId?: string;
  where?: FluxyInboxWhere;
}

interface FluxyInboxRoomEntryLike {
  roomId: string;
  roomName: string;
  roomType?: string;
  unreadCount: number;
  lastReadMessageId: number;
  firstUnreadMessageId: number | null;
  snoozedUntil?: string | null;
  lastMessage?: unknown;
}

interface FluxyInboxMentionLike {
  roomId: string;
}

interface FluxyInboxFollowUpLike {
  roomId: string;
}

export interface FluxyInboxSummaryLike {
  mentions: FluxyInboxMentionLike[];
  unreadRooms: FluxyInboxRoomEntryLike[];
  snoozedRooms: FluxyInboxRoomEntryLike[];
  followUps: FluxyInboxFollowUpLike[];
  counts: {
    mentions: number;
    unreadRooms: number;
    snoozedRooms: number;
    followUps: number;
  };
}

function matchOp<V>(value: V, op: FluxyWhereOp<V> | undefined): boolean {
  if (!op) return true;
  if (op.eq !== undefined) {
    const expected = op.eq;
    return Array.isArray(expected) ? expected.includes(value) : value === expected;
  }
  if (op.neq !== undefined) {
    const expected = op.neq;
    return Array.isArray(expected) ? !expected.includes(value) : value !== expected;
  }
  if (op.in !== undefined) return op.in.includes(value);
  if (op.gt !== undefined && typeof value === "number") return value > (op.gt as number);
  if (op.lt !== undefined && typeof value === "number") return value < (op.lt as number);
  return true;
}

function matchWhere<T extends object>(
  row: T,
  where: FluxyWhere<T> | undefined,
): boolean {
  if (!where) return true;
  for (const key of Object.keys(where) as Array<keyof T>) {
    const op = where[key as keyof typeof where] as FluxyWhereOp<unknown> | undefined;
    if (!matchOp((row as Record<string, unknown>)[key as string], op)) return false;
  }
  return true;
}

function roomEntryToFields(entry: FluxyInboxRoomEntryLike): FluxyInboxItemFields {
  return {
    roomId: entry.roomId,
    roomName: entry.roomName,
    roomType: entry.roomType,
    unreadCount: entry.unreadCount,
    snoozedUntil: entry.snoozedUntil ?? null,
  };
}

function filterRoomEntries(
  entries: FluxyInboxRoomEntryLike[],
  query: FluxyInboxQuery | undefined,
): FluxyInboxRoomEntryLike[] {
  if (!query?.roomId && !query?.where) return entries;
  return entries.filter((entry) => {
    if (query.roomId && entry.roomId !== query.roomId) return false;
    return matchWhere(roomEntryToFields(entry), query.where);
  });
}

function filterMentions(
  mentions: FluxyInboxMentionLike[],
  query: FluxyInboxQuery | undefined,
): FluxyInboxMentionLike[] {
  if (!query?.roomId) return mentions;
  return mentions.filter((m) => m.roomId === query.roomId);
}

function filterFollowUps(
  followUps: FluxyInboxFollowUpLike[],
  query: FluxyInboxQuery | undefined,
): FluxyInboxFollowUpLike[] {
  if (!query?.roomId) return followUps;
  return followUps.filter((f) => f.roomId === query.roomId);
}

/** Client-side inbox filter (REST snapshot or WS push). */
export function applyInboxQuery<T extends FluxyInboxSummaryLike>(
  summary: T,
  query: FluxyInboxQuery | undefined,
): T {
  if (!query?.roomId && !query?.where) return summary;

  const unreadRooms = filterRoomEntries(summary.unreadRooms, query);
  const snoozedRooms = filterRoomEntries(summary.snoozedRooms, query);
  const mentions = filterMentions(summary.mentions, query);
  const followUps = filterFollowUps(summary.followUps, query);

  return {
    ...summary,
    mentions,
    unreadRooms,
    snoozedRooms,
    followUps,
    counts: {
      mentions: mentions.length,
      unreadRooms: unreadRooms.length,
      snoozedRooms: snoozedRooms.length,
      followUps: followUps.length,
    },
  };
}

/** Event names that should trigger inbox reload over the user channel WS. */
export const FLUXY_INBOX_REFRESH_EVENT_NAMES = new Set([
  "inbox_updated",
  "inbox.refresh",
  "inbox:updated",
]);

export function isInboxRefreshUserEvent(event: {
  type?: string;
  name?: string;
  data?: unknown;
}): boolean {
  if (event.type !== "user_event") return false;
  if (event.name && FLUXY_INBOX_REFRESH_EVENT_NAMES.has(event.name)) return true;
  if (event.data && typeof event.data === "object" && event.data !== null) {
    const kind = (event.data as { kind?: string; type?: string }).kind
      ?? (event.data as { type?: string }).type;
    if (typeof kind === "string" && FLUXY_INBOX_REFRESH_EVENT_NAMES.has(kind)) return true;
  }
  return false;
}

/** Parse a single inbox item from a user-channel WS payload (optional Portal-style push). */
export function parseInboxItemFromUserEvent(event: {
  type?: string;
  name?: string;
  data?: unknown;
}): import("./inbox-items").FluxyInboxItem | null {
  if (event.type !== "user_event") return null;

  const data = event.data;
  if (!data || typeof data !== "object") return null;

  const row = data as Record<string, unknown>;
  const kind = (row.kind ?? row.itemKind ?? event.name) as string | undefined;
  const roomId = typeof row.roomId === "string" ? row.roomId : null;
  if (!roomId) return null;

  const normalizedKind =
    kind === "mention" || kind === "unread" || kind === "follow_up" || kind === "snooze"
      ? kind
      : event.name === "inbox_item"
        ? "unread"
        : null;
  if (!normalizedKind) return null;

  const id =
    typeof row.id === "string"
      ? row.id
      : `${normalizedKind}:${roomId}:${String(row.messageId ?? row.receivedAt ?? Date.now())}`;

  return {
    id,
    kind: normalizedKind,
    roomId,
    roomName: typeof row.roomName === "string" ? row.roomName : undefined,
    unreadCount: typeof row.unreadCount === "number" ? row.unreadCount : undefined,
    receivedAt:
      typeof row.receivedAt === "string"
        ? row.receivedAt
        : new Date().toISOString(),
    payload: row,
  };
}
