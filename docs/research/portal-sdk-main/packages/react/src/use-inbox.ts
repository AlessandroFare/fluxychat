import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type {
  InboxEntries,
  InboxEntry,
  InboxHandle,
  InboxItem,
  InboxSnapshot,
  InboxView,
} from "@portalsdk/core";

import { usePortal } from "./context.js";
import { isServerEnvironment } from "./ssr.js";
import type { UseInboxParams, UseInboxResult } from "./types.js";
import { useLatest } from "./use-latest.js";

/** An empty {@link InboxEntries}: an array whose `.get` always returns `undefined`. */
const INERT_CHANNELS: InboxEntries = Object.freeze(
  Object.assign([] as InboxEntry[], { get: () => undefined }),
) as InboxEntries;

const INERT_ITEMS = Object.freeze([]) as readonly never[];

/** Inert snapshot for server rendering — no inbox handle exists there. */
const INERT_INBOX_SNAPSHOT: InboxSnapshot = Object.freeze({
  channels: INERT_CHANNELS,
  items: INERT_ITEMS,
  counter: 0,
  status: "idle",
});

interface ViewSnapshotShape<D> {
  channels: InboxEntries;
  items: readonly InboxItem<D>[];
  unseen: number;
}

const INERT_VIEW_SNAPSHOT: ViewSnapshotShape<never> = Object.freeze({
  channels: INERT_CHANNELS,
  items: INERT_ITEMS,
  unseen: 0,
});

/**
 * Subscribe to the inbox. A thin binding over core's lazy inbox singleton.
 *
 * Two stores back the result, deliberately: the global {@link InboxHandle} carries the
 * app-wide `counter` and `status` (and owns `markAllRead`), while a filtered
 * {@link InboxView} carries this view's `channels`, `items`, and `unseen`. `counter` is
 * therefore global (it ignores the view filter) and `unseen` is scoped to the filter.
 *
 * During server rendering (`typeof window === "undefined"`), this never calls
 * `portal.inbox()` — unlike a channel handle, an inbox handle connects immediately on
 * creation (no separate `acquire()` step), so creating one server-side would be a real
 * network side effect. The result is the same inert, zero-entry snapshot server-side and on
 * the client's first (pre-hydration) render, so there is nothing to reconcile.
 */
export function useInbox<D = unknown>(params?: UseInboxParams<D>): UseInboxResult<D> {
  const portal = usePortal();
  const { onItem, ...query } = params ?? {};

  // Lazy singleton: the same handle every call, connected on first use.
  const inbox = useMemo<InboxHandle | undefined>(
    () => (isServerEnvironment() ? undefined : portal.inbox()),
    [portal],
  );

  // Recreate the view only when the query content changes, not on every render (a fresh
  // object each render would thrash the subscription). Serialized because the query is a
  // nested literal without a stable identity across renders.
  const queryKey = JSON.stringify(query);
  const view = useMemo<InboxView<D> | undefined>(
    () => inbox?.view<D>(query),
    // query is captured through queryKey; see note above.
    [inbox, queryKey],
  );

  // Fires once per item arriving after mount — never for the ready/backlog snapshot (core
  // never emits "item" for it) and never twice for the same id (core dedupes redelivery by
  // item id; see InboxConnection#onMessage and its test coverage). No parallel seen-set here:
  // this subscribes directly to core's event and trusts its dedup. Reads through a ref so an
  // inline callback each render doesn't churn the subscription.
  const onItemRef = useLatest(onItem);
  useEffect(() => {
    if (!inbox) return;
    return inbox.on("item", (item) => onItemRef.current?.(item as InboxItem<D>));
  }, [inbox, onItemRef]);

  const inboxSubscribe = useCallback(
    (listener: () => void) => (inbox ? inbox.subscribe(listener) : () => {}),
    [inbox],
  );
  const inboxGetSnapshot = useCallback(
    (): InboxSnapshot => (inbox ? inbox.getSnapshot() : INERT_INBOX_SNAPSHOT),
    [inbox],
  );
  const inboxGetServerSnapshot = useCallback((): InboxSnapshot => INERT_INBOX_SNAPSHOT, []);
  const inboxSnapshot = useSyncExternalStore(
    inboxSubscribe,
    inboxGetSnapshot,
    inboxGetServerSnapshot,
  );

  const viewSubscribe = useCallback(
    (listener: () => void) => (view ? view.subscribe(listener) : () => {}),
    [view],
  );
  const viewGetSnapshot = useCallback(
    (): ViewSnapshotShape<D> => (view ? view.getSnapshot() : INERT_VIEW_SNAPSHOT),
    [view],
  );
  const viewGetServerSnapshot = useCallback(
    (): ViewSnapshotShape<D> => INERT_VIEW_SNAPSHOT,
    [],
  );
  const viewSnapshot = useSyncExternalStore(viewSubscribe, viewGetSnapshot, viewGetServerSnapshot);

  const markAllRead = useCallback(() => inbox?.markAllRead(), [inbox]);

  return {
    channels: viewSnapshot.channels,
    items: viewSnapshot.items,
    counter: inboxSnapshot.counter, // global — ignores the view filter
    unseen: viewSnapshot.unseen, // within this view's filter
    markAllRead,
    status: inboxSnapshot.status,
  };
}
