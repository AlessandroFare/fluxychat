"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { FluxyChatClient, FluxyInboxSummary } from "./index";
import { useFluxyChatOptional } from "./use-fluxy-chat";
import {
  isInboxRefreshUserEvent,
  parseInboxItemFromUserEvent,
  type FluxyInboxQuery,
} from "./inbox-filter";
import type { FluxyInboxItem } from "./inbox-items";
import { createFluxyInboxStore, INERT_INBOX_SNAPSHOT } from "./inbox-store";

export interface UseInboxOptions {
  /** Omit when wrapped in `FluxyRealtimeProvider`. */
  client?: FluxyChatClient | null;
  /** Portal-style client-side filter over REST snapshot. */
  query?: FluxyInboxQuery;
  /** Poll interval in ms (default 30_000). Set 0 to disable polling. */
  pollIntervalMs?: number;
  /** Subscribe to `/ws/inbox` (default true when authenticated). Falls back to the user channel. */
  realtime?: boolean;
  /** Load immediately on mount (default true). */
  enabled?: boolean;
  /** Fires once per realtime inbox item pushed over the user channel WS. */
  onItem?: (item: FluxyInboxItem) => void;
}

export interface UseInboxResult {
  summary: FluxyInboxSummary | null;
  /** Flat items feed (REST snapshot + WS pushes). */
  items: readonly FluxyInboxItem[];
  /** Global unread room count for badges. */
  counter: number;
  /** Unread mentions + unread rooms in the current view. */
  unseen: number;
  status: "idle" | "loading" | "ready" | "error";
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

/**
 * React hook over REST `/inbox` with optional `where` filter, dedicated `/ws/inbox`
 * refresh, and Portal-style `items` + `onItem`.
 */
export function useInbox(options: UseInboxOptions = {}): UseInboxResult {
  const { pollIntervalMs = 30_000, enabled = true, query, realtime = true, onItem } = options;
  const realtimeCtx = useFluxyChatOptional();
  const client = options.client ?? realtimeCtx?.client ?? null;
  const onItemRef = useRef(onItem);
  onItemRef.current = onItem;

  const store = useMemo(() => createFluxyInboxStore(), []);

  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  const getServerSnapshot = useCallback(() => INERT_INBOX_SNAPSHOT, []);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const canFetch = Boolean(client?.isAuthenticated?.() ?? client);

  const reload = useCallback(async () => {
    if (!client || !enabled) return;
    if (typeof client.isAuthenticated === "function" && !client.isAuthenticated()) {
      store.reset();
      return;
    }
    store.setLoading(true);
    store.setError(null);
    try {
      const next = await client.getInbox(query);
      store.setSummary(next);
    } catch (err) {
      store.setError(err instanceof Error ? err : new Error("getInbox failed"));
    }
  }, [client, enabled, query, store]);

  useEffect(() => {
    if (!canFetch || !enabled) {
      store.reset();
      return;
    }
    void reload();
  }, [canFetch, enabled, reload, store]);

  useEffect(() => {
    if (!canFetch || !enabled || pollIntervalMs <= 0) return;
    const id = window.setInterval(() => {
      void reload();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [canFetch, enabled, pollIntervalMs, reload]);

  useEffect(() => {
    if (!canFetch || !enabled || !realtime || !client) return;

    let active = true;
    let ws: WebSocket | null = null;

    void (async () => {
      try {
        await client.resolveToken?.();
        if (!active) return;
        ws = typeof client.connectInbox === "function" ? client.connectInbox() : client.connectUser();
        const onMessage = (ev: MessageEvent) => {
          try {
            const data = JSON.parse(String(ev.data)) as {
              type?: string;
              name?: string;
              data?: unknown;
            };
            const item = parseInboxItemFromUserEvent(data);
            if (item) {
              store.pushItem(item);
              onItemRef.current?.(item);
            }
            if (isInboxRefreshUserEvent(data)) void reload();
          } catch {
            /* ignore */
          }
        };
        ws.addEventListener("message", onMessage);
        ws.addEventListener("close", () => {
          ws = null;
        });
      } catch {
        /* ignore WS setup errors */
      }
    })();

    return () => {
      active = false;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
    };
  }, [canFetch, enabled, realtime, client, reload, store]);

  return {
    summary: snapshot.summary,
    items: snapshot.items,
    counter: snapshot.counter,
    unseen: snapshot.unseen,
    status: snapshot.status,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
    reload,
  };
}
