import type { FluxyChatEvent } from "./fluxy-chat-client";
import type { FluxyChatRoomConnection } from "./room-connection";
import {
  parseLiveCursorEvent,
  type LiveCursor,
  type LiveCursorPublishInput,
} from "./live-cursors";
import { type FluxyPaginatedResult } from "./paginated-messages";
import { fluxySubscription, type FluxySubscription } from "./fluxy-subscription";

const MAX_CURSOR_HISTORY = 200;
const DEFAULT_CURSOR_HISTORY_LIMIT = 100;

/** In-session cursor history window (not Ably channel.history REST). */
export interface FluxyCursorHistoryParams {
  limit?: number;
  /** Exclusive lower bound on `ts`. */
  start?: number;
  /** Exclusive upper bound on `ts`. */
  end?: number;
}

/** Spaces CursorHistory-lite: last live position plus paged in-session points. */
export interface FluxyRoomCursors {
  set(input: LiveCursorPublishInput): void;
  get(userId?: string): LiveCursor | Record<string, LiveCursor> | undefined;
  getAll(): Record<string, LiveCursor>;
  /** Spaces `cursors.getSelf` — last live point for this connection's user. */
  getSelf(): Promise<LiveCursor | null>;
  /** Spaces `cursors.getOthers` — last live points excluding self. */
  getOthers(): Promise<Record<string, LiveCursor>>;
  history(params?: FluxyCursorHistoryParams): Promise<FluxyPaginatedResult<LiveCursor>>;
  subscribe(
    eventOrHandler: "update" | ((cursor: LiveCursor) => void),
    handler?: (cursor: LiveCursor) => void,
  ): FluxySubscription;
}

export function pageCursorHistory(
  points: LiveCursor[],
  params: FluxyCursorHistoryParams = {},
  firstParams: FluxyCursorHistoryParams = params,
): FluxyPaginatedResult<LiveCursor> {
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_CURSOR_HISTORY_LIMIT, 1), MAX_CURSOR_HISTORY);
  const filtered = points.filter((point) => {
    if (params.start != null && point.ts <= params.start) return false;
    if (params.end != null && point.ts >= params.end) return false;
    return true;
  });
  const newestFirst = [...filtered].sort((a, b) => b.ts - a.ts);
  const items = newestFirst.slice(0, limit);
  const hasMore = newestFirst.length > limit;
  const page: FluxyPaginatedResult<LiveCursor> = {
    items,
    hasNext() {
      return hasMore;
    },
    isLast() {
      return !hasMore;
    },
    async next() {
      if (!hasMore) return null;
      const oldestOnPage = items[items.length - 1];
      if (!oldestOnPage) return null;
      return pageCursorHistory(points, { ...params, limit, end: oldestOnPage.ts }, firstParams);
    },
    first() {
      return Promise.resolve(pageCursorHistory(points, { ...firstParams, limit: firstParams.limit ?? limit }, firstParams));
    },
    current() {
      return Promise.resolve(page);
    },
  };
  return page;
}

export function bindRoomCursors(connection: FluxyChatRoomConnection): FluxyRoomCursors {
  const last = new Map<string, LiveCursor>();
  const points: LiveCursor[] = [];
  connection.onAnyEvent((event: FluxyChatEvent) => {
    const cursor = parseLiveCursorEvent(event);
    if (!cursor) return;
    last.set(cursor.userId, cursor);
    points.push(cursor);
    if (points.length > MAX_CURSOR_HISTORY) points.splice(0, points.length - MAX_CURSOR_HISTORY);
  });
  return {
    set(input) {
      connection.sendCursor(input);
    },
    get(userId) {
      if (userId == null) return Object.fromEntries(last);
      return last.get(userId.trim());
    },
    getAll() {
      return Object.fromEntries(last);
    },
    async getSelf() {
      const userId = String(connection.userId || "").trim();
      if (!userId) return null;
      return last.get(userId) ?? null;
    },
    async getOthers() {
      const selfId = String(connection.userId || "").trim();
      return Object.fromEntries([...last].filter(([userId]) => userId !== selfId));
    },
    async history(params) {
      let rest: LiveCursor[] = [];
      if (typeof connection.fetchCursorHistory === "function") {
        try {
          rest = await connection.fetchCursorHistory();
        } catch {
          rest = [];
        }
      }
      const seen = new Set(points.map((row) => `${row.userId}:${row.ts}`));
      const merged = [...points];
      for (const row of rest) {
        const key = `${row.userId}:${row.ts}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
      return pageCursorHistory(merged, params ?? {}, params ?? {});
    },
    subscribe(eventOrHandler, handler) {
      const listenerFn =
        typeof eventOrHandler === "function" ? eventOrHandler : handler;
      if (!listenerFn) {
        throw new Error("unable to subscribe cursors; listener required");
      }
      if (typeof eventOrHandler === "string" && eventOrHandler !== "update") {
        throw new Error("unable to subscribe cursors; only update events exist");
      }
      const listener = (event: FluxyChatEvent) => {
        const cursor = parseLiveCursorEvent(event);
        if (cursor) listenerFn(cursor);
      };
      connection.onAnyEvent(listener);
      return fluxySubscription(() => connection.offAnyEvent(listener));
    },
  };
}
