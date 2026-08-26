import type { FluxyInboxSummary } from "./index";

export type FluxyInboxItemKind =
  | "mention"
  | "unread"
  | "follow_up"
  | "snooze"
  | "thread"
  | "comment"
  | "custom";

/** Normalized inbox row for views and realtime `onItem` (Portal-style items feed). */
export interface FluxyInboxItem {
  id: string;
  kind: FluxyInboxItemKind;
  roomId: string;
  roomName?: string;
  unreadCount?: number;
  receivedAt: string;
  payload?: unknown;
}

function itemId(kind: FluxyInboxItemKind, roomId: string, suffix?: string): string {
  return suffix ? `${kind}:${roomId}:${suffix}` : `${kind}:${roomId}`;
}

/** Build a flat items list from a REST inbox snapshot. */
export function inboxSummaryToItems(summary: FluxyInboxSummary): FluxyInboxItem[] {
  const items: FluxyInboxItem[] = [];
  const now = new Date().toISOString();

  for (const m of summary.mentions ?? []) {
    items.push({
      id: itemId("mention", m.roomId, String(m.messageId ?? m.createdAt ?? "")),
      kind: "mention",
      roomId: m.roomId,
      roomName: m.roomName,
      receivedAt: m.createdAt ?? now,
      payload: m,
    });
  }

  for (const r of summary.unreadRooms ?? []) {
    items.push({
      id: itemId("unread", r.roomId),
      kind: "unread",
      roomId: r.roomId,
      roomName: r.roomName,
      unreadCount: r.unreadCount,
      receivedAt: now,
      payload: r,
    });
  }

  for (const s of summary.snoozedRooms ?? []) {
    items.push({
      id: itemId("snooze", s.roomId),
      kind: "snooze",
      roomId: s.roomId,
      roomName: s.roomName,
      receivedAt: s.snoozedUntil ?? now,
      payload: s,
    });
  }

  for (const f of summary.followUps ?? []) {
    items.push({
      id: itemId("follow_up", f.roomId, f.id),
      kind: "follow_up",
      roomId: f.roomId,
      roomName: f.roomName,
      receivedAt: f.createdAt ?? now,
      payload: f,
    });
  }

  return items;
}

/** Merge a realtime item; dedupe by `id`, newest `receivedAt` wins. */
export function mergeInboxItem(
  items: readonly FluxyInboxItem[],
  incoming: FluxyInboxItem,
): FluxyInboxItem[] {
  const idx = items.findIndex((row) => row.id === incoming.id);
  if (idx < 0) return [...items, incoming];
  const next = [...items];
  next[idx] = incoming;
  return next;
}

export function countUnseenItems(items: readonly FluxyInboxItem[]): number {
  return items.filter(
    (row) =>
      row.kind === "unread" ||
      row.kind === "mention" ||
      row.kind === "thread" ||
      row.kind === "comment",
  ).length;
}

/** Map a comment-thread fan-out into an inbox row (LB-NOTIF). */
export function commentEventToInboxItem(input: {
  roomId: string;
  roomName?: string;
  kind: "thread" | "comment";
  id: string;
  receivedAt?: string;
  payload?: unknown;
}): FluxyInboxItem {
  return {
    id: itemId(input.kind, input.roomId, input.id),
    kind: input.kind,
    roomId: input.roomId,
    roomName: input.roomName,
    receivedAt: input.receivedAt ?? new Date().toISOString(),
    payload: input.payload,
  };
}
