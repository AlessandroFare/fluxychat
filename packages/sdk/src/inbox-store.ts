import type { FluxyInboxSummary } from "./index";
import {
  countUnseenItems,
  inboxSummaryToItems,
  mergeInboxItem,
  type FluxyInboxItem,
} from "./inbox-items";

export interface FluxyInboxStoreSnapshot {
  summary: FluxyInboxSummary | null;
  items: readonly FluxyInboxItem[];
  counter: number;
  unseen: number;
  isLoading: boolean;
  error: Error | null;
  status: "idle" | "loading" | "ready" | "error";
}

export type FluxyInboxStoreListener = () => void;

export interface FluxyInboxStore {
  subscribe: (listener: FluxyInboxStoreListener) => () => void;
  getSnapshot: () => FluxyInboxStoreSnapshot;
}

const INERT_INBOX_SNAPSHOT: FluxyInboxStoreSnapshot = Object.freeze({
  summary: null,
  items: Object.freeze([]) as readonly FluxyInboxItem[],
  counter: 0,
  unseen: 0,
  isLoading: false,
  error: null,
  status: "idle",
});

export function createFluxyInboxStore(): FluxyInboxStore & {
  setLoading: (isLoading: boolean) => void;
  setError: (error: Error | null) => void;
  setSummary: (summary: FluxyInboxSummary | null) => void;
  pushItem: (item: FluxyInboxItem) => void;
  reset: () => void;
} {
  let snapshot: FluxyInboxStoreSnapshot = INERT_INBOX_SNAPSHOT;
  const listeners = new Set<FluxyInboxStoreListener>();

  function emit(next: FluxyInboxStoreSnapshot): void {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function derive(
    partial: Partial<FluxyInboxStoreSnapshot> & { summary?: FluxyInboxSummary | null },
  ): FluxyInboxStoreSnapshot {
    const summary = partial.summary !== undefined ? partial.summary : snapshot.summary;
    const items =
      partial.items ??
      (summary ? inboxSummaryToItems(summary) : snapshot.items);
    const counter =
      partial.counter ??
      (summary?.counts?.unreadRooms ?? summary?.unreadRooms?.length ?? snapshot.counter);
    const unseen = partial.unseen ?? countUnseenItems(items);
    return {
      summary,
      items,
      counter,
      unseen,
      isLoading: partial.isLoading ?? snapshot.isLoading,
      error: partial.error !== undefined ? partial.error : snapshot.error,
      status: partial.status ?? snapshot.status,
    };
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    setLoading(isLoading) {
      emit(
        derive({
          isLoading,
          status: isLoading ? "loading" : snapshot.summary ? "ready" : snapshot.status,
        }),
      );
    },
    setError(error) {
      emit(
        derive({
          error,
          isLoading: false,
          status: error ? "error" : snapshot.summary ? "ready" : "idle",
        }),
      );
    },
    setSummary(summary) {
      emit(
        derive({
          summary,
          isLoading: false,
          error: null,
          status: summary ? "ready" : "idle",
        }),
      );
    },
    pushItem(item) {
      const items = mergeInboxItem(snapshot.items, item);
      emit(
        derive({
          items,
          unseen: countUnseenItems(items),
          status: "ready",
        }),
      );
    },
    reset() {
      emit(INERT_INBOX_SNAPSHOT);
    },
  };
}

export { INERT_INBOX_SNAPSHOT };
