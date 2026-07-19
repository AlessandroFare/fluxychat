import type { Unsubscribe } from "./types.js";

/**
 * The `useSyncExternalStore`-shaped store primitive every handle is built on.
 *
 * `getSnapshot` returns a stable reference while state is unchanged — callers must build a
 * new snapshot object only when something actually changed, so React can bail out of a
 * re-render by identity. `subscribe` and `getSnapshot` are bound, so they survive being
 * passed detached.
 */
export class Store<T> {
  #snapshot: T;
  readonly #listeners = new Set<() => void>();

  constructor(initial: T) {
    this.#snapshot = initial;
  }

  getSnapshot = (): T => this.#snapshot;

  subscribe = (listener: () => void): Unsubscribe => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Replace the snapshot and notify. A referentially-equal value is a no-op. */
  set(next: T): void {
    if (Object.is(next, this.#snapshot)) return;
    this.#snapshot = next;
    for (const listener of this.#listeners) listener();
  }

  /** Derive the next snapshot from the current one. */
  update(fn: (prev: T) => T): void {
    this.set(fn(this.#snapshot));
  }

  /** Live subscriber count — used by dev-mode leak diagnostics. */
  get listenerCount(): number {
    return this.#listeners.size;
  }
}
