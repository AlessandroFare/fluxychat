/**
 * Hibernation-safe WebSocket session registry for Durable Objects.
 *
 * WHY THIS EXISTS
 * ---------------
 * Calling `webSocket.accept()` inside a Durable Object pins the object in memory
 * for the *entire* lifetime of the connection, and Cloudflare bills Durable Object
 * duration (128 MB x wall-clock seconds) for that whole window. From the Cloudflare
 * pricing docs:
 *
 *   "Calling accept() on a WebSocket in an Object will incur duration charges for
 *    the entire time the WebSocket is connected. It is recommended to use the
 *    WebSocket Hibernation API to avoid incurring duration charges once all event
 *    handlers finish running."
 *
 * Cloudflare's own published examples put the delta at roughly 40x per
 * connection-hour (their Example 2 vs Example 4). For a chat platform whose
 * positioning is edge unit economics, `accept()` is not a missed optimisation —
 * it inverts the cost model.
 *
 * The Hibernation API (`state.acceptWebSocket`) lets the runtime evict the object
 * from memory while keeping sockets open, then rehydrate it on the next inbound
 * frame. The catch: every piece of per-socket state held in an in-memory `Map`
 * keyed by the socket is gone after eviction.
 *
 * WHAT THIS MODULE DOES
 * ---------------------
 * It moves per-socket state into the socket's own *attachment*
 * (`serializeAttachment` / `deserializeAttachment`), which the runtime persists
 * across hibernation, and exposes it through a `Map`-compatible facade so existing
 * call sites (`this.userIds.get(ws)`, `this.socketIds.set(ws, id)`, ...) keep
 * working untouched.
 *
 * It also degrades gracefully: when `state.acceptWebSocket` is unavailable (unit
 * test stubs, older compat dates) it falls back to `webSocket.accept()` plus
 * in-memory maps, preserving previous behaviour.
 *
 * ATTACHMENT BUDGET
 * -----------------
 * The runtime caps attachments at 2 KB per socket. We keep keys short, store only
 * identity/authorisation facts, and refuse (with a logged warning) any write that
 * would exceed the budget rather than letting the runtime throw mid-broadcast.
 */

const ATTACHMENT_BUDGET_BYTES = 2048;
/** Leave headroom so a later single-field patch cannot tip us over the hard limit. */
const ATTACHMENT_SOFT_BUDGET_BYTES = 1600;

/**
 * Map-compatible view over one field of the per-socket attachment.
 *
 * Supports non-WebSocket keys too: `room-do` historically stored synthetic
 * `"recovered:<userId>"` presence entries in the same map as real sockets. Those
 * are room-level, not socket-level, so they live in a plain internal Map.
 *
 * @template V
 */
class AttachmentBackedMap {
  /**
   * @param {WsSessionRegistry} registry
   * @param {string} field short attachment key (kept terse for the 2 KB budget)
   */
  constructor(registry, field) {
    this.registry = registry;
    this.field = field;
    /** @type {Map<string, V>} non-socket keys (synthetic presence entries) */
    this.synthetic = new Map();
  }

  /** @param {unknown} key */
  #isSocket(key) {
    return typeof key === "object" && key !== null;
  }

  /**
   * @param {any} key
   * @returns {V | undefined}
   */
  get(key) {
    if (!this.#isSocket(key)) return this.synthetic.get(key);
    const data = this.registry.read(key);
    return data?.[this.field];
  }

  /**
   * @param {any} key
   * @param {V} value
   */
  set(key, value) {
    if (!this.#isSocket(key)) {
      this.synthetic.set(key, value);
      return this;
    }
    this.registry.write(key, { [this.field]: value });
    return this;
  }

  /** @param {any} key */
  has(key) {
    if (!this.#isSocket(key)) return this.synthetic.has(key);
    const data = this.registry.read(key);
    return data ? Object.prototype.hasOwnProperty.call(data, this.field) : false;
  }

  /** @param {any} key */
  delete(key) {
    if (!this.#isSocket(key)) return this.synthetic.delete(key);
    const data = this.registry.read(key);
    if (!data || !Object.prototype.hasOwnProperty.call(data, this.field)) return false;
    this.registry.clearField(key, this.field);
    return true;
  }

  get size() {
    let n = this.synthetic.size;
    for (const ws of this.registry.sockets()) {
      const data = this.registry.read(ws);
      if (data && Object.prototype.hasOwnProperty.call(data, this.field)) n++;
    }
    return n;
  }

  /** @returns {IterableIterator<[any, V]>} */
  *entries() {
    for (const ws of this.registry.sockets()) {
      const data = this.registry.read(ws);
      if (data && Object.prototype.hasOwnProperty.call(data, this.field)) {
        yield [ws, data[this.field]];
      }
    }
    yield* this.synthetic.entries();
  }

  /** @returns {IterableIterator<V>} */
  *values() {
    for (const [, v] of this.entries()) yield v;
  }

  /** @returns {IterableIterator<any>} */
  *keys() {
    for (const [k] of this.entries()) yield k;
  }

  [Symbol.iterator]() {
    return this.entries();
  }

  /** @param {(value: V, key: any, map: this) => void} fn */
  forEach(fn) {
    for (const [k, v] of this.entries()) fn(v, k, this);
  }

  clear() {
    this.synthetic.clear();
    for (const ws of this.registry.sockets()) {
      this.registry.clearField(ws, this.field);
    }
  }
}

/**
 * Set-compatible view over the live socket collection.
 *
 * Replaces `this.clients = new Set()`. Backed by `state.getWebSockets()` so it is
 * correct immediately after a hibernation wake, when an in-memory Set would be
 * empty and every broadcast would silently reach nobody.
 */
class SocketSetView {
  /** @param {WsSessionRegistry} registry */
  constructor(registry) {
    this.registry = registry;
  }

  get size() {
    return this.registry.sockets().length;
  }

  /** @param {WebSocket} ws */
  add(ws) {
    this.registry.track(ws);
    return this;
  }

  /** @param {WebSocket} ws */
  has(ws) {
    return this.registry.sockets().includes(ws);
  }

  /**
   * Removing a socket from the live set means dropping our bookkeeping for it.
   * The socket itself is closed by the caller / runtime.
   * @param {WebSocket} ws
   */
  delete(ws) {
    const had = this.has(ws);
    this.registry.forget(ws);
    return had;
  }

  [Symbol.iterator]() {
    return this.registry.sockets()[Symbol.iterator]();
  }

  /** @returns {IterableIterator<WebSocket>} */
  values() {
    return this.registry.sockets()[Symbol.iterator]();
  }

  /** @param {(ws: WebSocket) => void} fn */
  forEach(fn) {
    for (const ws of this.registry.sockets()) fn(ws);
  }

  clear() {
    for (const ws of this.registry.sockets()) this.registry.forget(ws);
  }
}

export class WsSessionRegistry {
  /**
   * @param {DurableObjectState | any} state
   * @param {{ onAttachmentOverflow?: (info: { bytes: number, field?: string }) => void }} [hooks]
   */
  constructor(state, hooks = {}) {
    this.state = state;
    this.hooks = hooks;
    this.hibernatable =
      typeof state?.acceptWebSocket === "function" && typeof state?.getWebSockets === "function";
    /** Sockets we own when the Hibernation API is unavailable (tests / legacy). */
    this.fallbackSockets = new Set();
    /**
     * Hot-path cache of decoded attachments. A WeakMap keeps this from leaking:
     * entries vanish with the socket. On a hibernation wake the cache is cold and
     * we transparently re-read from the attachment.
     * @type {WeakMap<object, Record<string, any>>}
     */
    this.cache = new WeakMap();
    /** Sockets closed/forgotten in this isolate lifetime, excluded from `sockets()`. */
    this.forgotten = new WeakSet();
  }

  /** True when running with real WebSocket Hibernation (i.e. not billed for idle). */
  get hibernationEnabled() {
    return this.hibernatable;
  }

  /**
   * Accept a socket. Uses the Hibernation API when available so the object stops
   * incurring duration charges once handlers return.
   *
   * @param {WebSocket} ws
   * @param {string[]} [tags] up to 10 tags, 256 chars each; enables `getWebSockets(tag)`
   */
  accept(ws, tags = []) {
    if (this.hibernatable) {
      this.state.acceptWebSocket(ws, tags);
    } else {
      ws.accept();
      this.fallbackSockets.add(ws);
    }
    return ws;
  }

  /**
   * Register a socket we did not accept ourselves (or re-register after a wake).
   * @param {WebSocket} ws
   */
  track(ws) {
    this.forgotten.delete?.(ws);
    if (!this.hibernatable) this.fallbackSockets.add(ws);
    return ws;
  }

  /** @returns {WebSocket[]} live sockets, correct across hibernation wakes */
  sockets() {
    const all = this.hibernatable ? this.state.getWebSockets() : [...this.fallbackSockets];
    if (!all || !all.length) return [];
    return all.filter((ws) => !this.forgotten.has(ws));
  }

  /** @returns {WebSocket[]} sockets carrying a given tag (hibernation mode only) */
  socketsByTag(tag) {
    if (!this.hibernatable) return this.sockets();
    try {
      return (this.state.getWebSockets(tag) || []).filter((ws) => !this.forgotten.has(ws));
    } catch {
      return this.sockets();
    }
  }

  get size() {
    return this.sockets().length;
  }

  /**
   * Read the decoded attachment for a socket.
   * @param {WebSocket | any} ws
   * @returns {Record<string, any>}
   */
  read(ws) {
    if (!ws || typeof ws !== "object") return {};
    const cached = this.cache.get(ws);
    if (cached) return cached;
    let data = {};
    if (typeof ws.deserializeAttachment === "function") {
      try {
        const raw = ws.deserializeAttachment();
        if (raw && typeof raw === "object") data = raw;
      } catch {
        data = {};
      }
    }
    this.cache.set(ws, data);
    return data;
  }

  /**
   * Merge a patch into the socket attachment and persist it.
   *
   * Writes are budget-checked: exceeding the runtime's 2 KB attachment cap would
   * otherwise throw from inside a broadcast loop and drop the connection.
   *
   * @param {WebSocket | any} ws
   * @param {Record<string, any>} patch
   */
  write(ws, patch) {
    if (!ws || typeof ws !== "object") return {};
    const next = { ...this.read(ws), ...patch };
    this.#persist(ws, next, Object.keys(patch)[0]);
    return next;
  }

  /**
   * @param {WebSocket | any} ws
   * @param {string} field
   */
  clearField(ws, field) {
    if (!ws || typeof ws !== "object") return;
    const next = { ...this.read(ws) };
    delete next[field];
    this.#persist(ws, next, field);
  }

  /**
   * @param {WebSocket | any} ws
   * @param {Record<string, any>} next
   * @param {string} [field]
   */
  #persist(ws, next, field) {
    if (typeof ws.serializeAttachment === "function") {
      let encoded;
      try {
        encoded = JSON.stringify(next);
      } catch {
        // Non-serialisable payload: keep the in-memory view, skip persistence
        // rather than corrupting the socket state.
        this.cache.set(ws, next);
        return;
      }
      const bytes = encoded.length;
      if (bytes > ATTACHMENT_SOFT_BUDGET_BYTES) {
        this.hooks.onAttachmentOverflow?.({ bytes, field });
        if (bytes > ATTACHMENT_BUDGET_BYTES) {
          // Refuse the write; the previous attachment stays valid.
          return;
        }
      }
      try {
        ws.serializeAttachment(next);
      } catch {
        /* persistence unavailable; in-memory cache still serves this isolate */
      }
    }
    this.cache.set(ws, next);
  }

  /**
   * Drop all bookkeeping for a socket (on close/error).
   * @param {WebSocket | any} ws
   */
  forget(ws) {
    if (!ws || typeof ws !== "object") return;
    this.cache.delete(ws);
    this.fallbackSockets.delete(ws);
    this.forgotten.add(ws);
  }

  /**
   * Build a `Map`-compatible view over one attachment field.
   * @template V
   * @param {string} field
   * @returns {AttachmentBackedMap<V>}
   */
  field(field) {
    return new AttachmentBackedMap(this, field);
  }

  /** Build a `Set`-compatible view over the live socket collection. */
  socketSet() {
    return new SocketSetView(this);
  }
}

/**
 * Install Cloudflare's application-level ping/pong auto-responder.
 *
 * Auto-responses are handled by the runtime without waking the object, so
 * keepalive traffic costs neither duration nor a request. Without this, every
 * client heartbeat rehydrates the Durable Object and is billed.
 *
 * @param {DurableObjectState | any} state
 * @param {{ requestPayload?: string, responsePayload?: string }} [opts]
 * @returns {boolean} whether the auto-responder was installed
 */
export function installWsAutoResponse(state, opts = {}) {
  const request = opts.requestPayload ?? JSON.stringify({ type: "ping" });
  const response = opts.responsePayload ?? JSON.stringify({ type: "pong" });
  const Pair = /** @type {any} */ (globalThis).WebSocketRequestResponsePair;
  if (typeof state?.setWebSocketAutoResponse !== "function" || typeof Pair !== "function") {
    return false;
  }
  try {
    state.setWebSocketAutoResponse(new Pair(request, response));
    return true;
  } catch {
    return false;
  }
}

export const WS_ATTACHMENT_BUDGET_BYTES = ATTACHMENT_BUDGET_BYTES;
export const WS_ATTACHMENT_SOFT_BUDGET_BYTES = ATTACHMENT_SOFT_BUDGET_BYTES;
