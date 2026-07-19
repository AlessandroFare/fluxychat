/** Keepalive ping cadence (§1.3), SDK-internal. */
const KEEPALIVE_INTERVAL_MS = 25_000;

/**
 * Sends a keepalive ping on an interval while a socket is open (§1.3).
 *
 * This only keeps the connection warm — liveness detection and reconnect are the
 * transport's job, so the pong is tolerated by absence and there is no second liveness
 * detector here. The interval is unref'd where the runtime supports it, so a forgotten
 * socket never holds a process open.
 */
export class Keepalive {
  #timer: ReturnType<typeof setInterval> | undefined;
  readonly #send: () => void;

  constructor(send: () => void) {
    this.#send = send;
  }

  /** (Re)start the ping interval — call on each `open`. */
  start(): void {
    this.stop();
    const timer = setInterval(this.#send, KEEPALIVE_INTERVAL_MS);
    (timer as { unref?: () => void }).unref?.();
    this.#timer = timer;
  }

  /** Stop pinging — call on close and teardown. */
  stop(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }
}
