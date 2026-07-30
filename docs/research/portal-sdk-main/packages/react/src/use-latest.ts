import { useEffect, useRef } from "react";

import type { MutableRefObject } from "react";

/**
 * Keeps a ref pointing at the latest value without making that value a dependency.
 *
 * Used for callback props (`onMention`, `onError`): the event subscription reads
 * `ref.current` when an event fires, so a caller passing a fresh inline function every render
 * never forces the acquire/subscribe effects to tear down and re-run. The ref is refreshed
 * after commit, which is in time for the async socket events these callbacks handle.
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
