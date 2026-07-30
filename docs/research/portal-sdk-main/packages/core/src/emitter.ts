import type { Unsubscribe } from "./types.js";

/**
 * A minimal typed event emitter backing the `on(event, fn)` surface of the handles.
 *
 * Listeners are held per event; `on` returns an unsubscribe. Emitting to an event with no
 * listeners is a no-op. A listener added or removed during emission does not affect the
 * in-flight dispatch (the listener set is snapshotted per emit).
 *
 * The self-referential constraint accepts a plain listener interface (which has no index
 * signature) while still requiring every value to be a function.
 */
export class Emitter<Events extends Record<keyof Events, (...args: never[]) => void>> {
  readonly #handlers = new Map<keyof Events, Set<(...args: never[]) => void>>();

  on<E extends keyof Events>(event: E, fn: Events[E]): Unsubscribe {
    let set = this.#handlers.get(event);
    if (set === undefined) {
      set = new Set();
      this.#handlers.set(event, set);
    }
    set.add(fn as (...args: never[]) => void);
    return () => {
      this.#handlers.get(event)?.delete(fn as (...args: never[]) => void);
    };
  }

  emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): void {
    const set = this.#handlers.get(event);
    if (set === undefined) return;
    for (const fn of [...set]) (fn as (...a: Parameters<Events[E]>) => void)(...args);
  }
}
