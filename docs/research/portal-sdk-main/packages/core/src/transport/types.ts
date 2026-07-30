/**
 * The socket seam.
 *
 * The connection manager programs against {@link Socket}/{@link SocketFactory} and never
 * touches the underlying transport. Production supplies a `partysocket`-backed factory;
 * tests supply an in-memory mock. Reconnection and backoff live below this seam (the
 * transport owns them); the manager only decides when to stop — by calling `close()` — and
 * how to react to each event.
 */

/** What the manager observes from a socket. */
export type SocketEvent =
  /** The upgrade succeeded; the socket is open. Fires again after each reconnect. */
  | { type: "open" }
  /** A text frame arrived. */
  | { type: "message"; data: string }
  /**
   * The upgrade was refused (§1.1). `code` is the refusal code; the manager classifies it
   * into terminal-vs-retryable. The transport keeps reconnecting until the manager calls
   * `close()`, so a terminal refusal must be closed.
   */
  | { type: "refused"; code: string; reason?: string }
  /** The socket dropped and the transport is reconnecting (transient). */
  | { type: "closed" }
  /** An unexpected transport error. */
  | { type: "error"; error: Error };

export interface Socket {
  /** Send a raw text frame. Buffered by the transport if the socket is not open. */
  send(data: string): void;
  /**
   * Force an immediate reconnection attempt, resetting backoff and re-invoking the URL
   * provider. Used to retry with a refreshed token, and to honour a `reassign` (§2.1).
   */
  reconnect(): void;
  /** Permanently close and stop reconnecting. Idempotent; no events follow. */
  close(): void;
}

export interface SocketInit {
  /**
   * Builds the upgrade URL for the next connection attempt. Re-invoked per attempt so the
   * token, `leaf` hint, and `last=` seq are regenerated fresh on every reconnect.
   */
  url: () => Promise<string>;
  /** Receives every {@link SocketEvent}. */
  onEvent: (event: SocketEvent) => void;
}

/** Creates a live socket and begins connecting immediately. */
export type SocketFactory = (init: SocketInit) => Socket;
