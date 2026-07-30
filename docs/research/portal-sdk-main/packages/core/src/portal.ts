import { ChannelHandleImpl } from "./channel.js";
import { resolveHosts, type ResolvedHosts } from "./config.js";
import { Credentials } from "./credentials.js";
import { devWarn } from "./env.js";
import { InboxConnection } from "./inbox/connection.js";
import { InboxHandleImpl } from "./inbox/handle.js";
import type { TokenSource } from "./token.js";
import type {
  ChannelHandle,
  ChannelOptions,
  InboxHandle,
  PortalConfig,
} from "./types.js";

interface ChannelEntry {
  /**
   * The handle is held weakly: while the caller (or React) keeps a reference it is
   * returned for the same id, but once every reference is dropped it can be collected —
   * which is what lets the dev-mode leak diagnostic fire on an acquired-and-forgotten
   * handle even while the Portal itself lives on.
   */
  ref: WeakRef<ChannelHandleImpl>;
  /** The options the handle was created with, for the first-creation-wins warning. */
  optionsKey: string;
}

const optionsKey = (options: ChannelOptions | undefined): string =>
  JSON.stringify({
    history: options?.history ?? null,
    metadata: options?.metadata ?? null,
  });

/**
 * The Portal client (§1).
 *
 * Construction is synchronous and passive: it stores config and creates empty registries,
 * with no network, no token fetch, and no validation. The first `acquire()` (or the first
 * inbox subscription) is the first network moment — safe to construct at module scope
 * before any user exists.
 */
export class Portal {
  readonly #config: PortalConfig;
  readonly #hosts: ResolvedHosts;
  readonly #credentials: Credentials;
  readonly #channels = new Map<string, ChannelEntry>();
  #inbox: InboxHandleImpl | undefined;
  /** Evicts a dead registry entry once its handle has been collected. */
  readonly #evictions =
    typeof FinalizationRegistry !== "undefined"
      ? new FinalizationRegistry<string>((channelId) => {
          const entry = this.#channels.get(channelId);
          if (entry !== undefined && entry.ref.deref() === undefined) {
            this.#channels.delete(channelId);
          }
        })
      : undefined;

  constructor(config: PortalConfig) {
    this.#config = config;
    this.#hosts = resolveHosts(config);
    this.#credentials = new Credentials({
      hosts: this.#hosts,
      apiKey: config.apiKey,
      token: config.token,
    });
  }

  /**
   * Registry lookup-or-create: the same object for the same id, as long as a reference is
   * still held. No network until `acquire()`. Options apply at first creation — a later
   * call with different options returns the existing handle and ignores them (dev-mode
   * warning; silent in production).
   */
  channel<M = unknown>(channelId: string, options?: ChannelOptions): ChannelHandle<M> {
    const existing = this.#channels.get(channelId)?.ref.deref();
    if (existing !== undefined) {
      const entry = this.#channels.get(channelId);
      if (options !== undefined && entry !== undefined && optionsKey(options) !== entry.optionsKey) {
        devWarn(
          `channel("${channelId}") was already created with different options; ` +
            `the original options are kept and these are ignored`,
        );
      }
      return existing as unknown as ChannelHandle<M>;
    }

    const handle = new ChannelHandleImpl({
      channelId,
      hosts: this.#hosts,
      apiKey: this.#config.apiKey,
      credentials: this.#credentials,
      options,
    });
    this.#channels.set(channelId, {
      ref: new WeakRef(handle),
      optionsKey: optionsKey(options),
    });
    this.#evictions?.register(handle, channelId);
    return handle as unknown as ChannelHandle<M>;
  }

  /** Lazy singleton — created and subscribed on first use, never at construction. */
  inbox(): InboxHandle {
    if (this.#inbox === undefined) {
      const connection = new InboxConnection({
        hosts: this.#hosts,
        apiKey: this.#config.apiKey,
        credentials: this.#credentials,
      });
      this.#inbox = new InboxHandleImpl(connection);
      connection.connect();
    }
    return this.#inbox;
  }

  /**
   * Replace the token source. Pass a string or callback to authenticate as that user (e.g.
   * on login), or `undefined` to return to anonymous mode (the SDK mints and manages its own
   * anonymous credential). Passing the same source is a no-op. When the identity changes,
   * any live channels and the inbox re-authenticate so no stale-identity session lingers;
   * idle handles pick up the new credential on their next use.
   */
  setToken(token: string | (() => string | Promise<string>) | undefined): void {
    if (!this.#credentials.setToken(token as TokenSource | undefined)) return;
    for (const entry of this.#channels.values()) entry.ref.deref()?.reauthenticate();
    this.#inbox?.reauthenticate();
  }
}
