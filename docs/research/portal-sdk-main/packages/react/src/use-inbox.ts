import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { InboxQuery } from "@portalsdk/core";

import { usePortal } from "./context.js";
import { assertBrowser } from "./ssr.js";
import type { UseInboxResult } from "./types.js";

/**
 * Subscribe to the inbox. A thin binding over core's lazy inbox singleton.
 *
 * Two stores back the result, deliberately: the global {@link InboxHandle} carries the
 * app-wide `counter` and `status` (and owns `markAllRead`), while a filtered
 * {@link InboxView} carries this view's `channels`, `items`, and `unseen`. `counter` is
 * therefore global (it ignores the view filter) and `unseen` is scoped to the filter.
 */
export function useInbox<D = unknown>(params?: InboxQuery<D>): UseInboxResult<D> {
  assertBrowser();

  const portal = usePortal();

  // Lazy singleton: the same handle every call, connected on first use.
  const inbox = useMemo(() => portal.inbox(), [portal]);

  // Recreate the view only when the query content changes, not on every render (a fresh
  // object each render would thrash the subscription). Serialized because the query is a
  // nested literal without a stable identity across renders.
  const queryKey = JSON.stringify(params ?? {});
  const view = useMemo(
    () => inbox.view<D>(params ?? {}),
    // params is captured through queryKey; see note above.
    [inbox, queryKey],
  );

  const inboxSnapshot = useSyncExternalStore(
    useCallback((listener: () => void) => inbox.subscribe(listener), [inbox]),
    useCallback(() => inbox.getSnapshot(), [inbox]),
  );
  const viewSnapshot = useSyncExternalStore(
    useCallback((listener: () => void) => view.subscribe(listener), [view]),
    useCallback(() => view.getSnapshot(), [view]),
  );

  const markAllRead = useCallback(() => inbox.markAllRead(), [inbox]);

  return {
    channels: viewSnapshot.channels,
    items: viewSnapshot.items,
    counter: inboxSnapshot.counter, // global — ignores the view filter
    unseen: viewSnapshot.unseen, // within this view's filter
    markAllRead,
    status: inboxSnapshot.status,
  };
}
