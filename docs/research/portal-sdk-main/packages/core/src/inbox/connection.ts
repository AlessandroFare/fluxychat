import {
  isInboxCounter,
  isInboxEntry,
  isInboxItem,
  isInboxReady,
  parseInboxFrame,
  serializeFrame,
  type InboxEntryWire,
  type InboxItemWire,
  type InboxMuteFrame,
  type InboxItemReadFrame,
  type InboxReadAllFrame,
  type InboxReadFrame,
  type PingFrame,
} from "@portalsdk/wire-protocol";

import type { ResolvedHosts } from "../config.js";
import type { Credentials } from "../credentials.js";
import { Emitter } from "../emitter.js";
import { Keepalive } from "../keepalive.js";
import { classifyRefusal } from "../refusal.js";
import { Store } from "../store.js";
import { getSocketFactory } from "../transport/factory.js";
import type { Socket, SocketEvent } from "../transport/types.js";
import type {
  InboxEntries,
  InboxEntry,
  InboxEvents,
  InboxItem,
  InboxSnapshot,
  InboxStatus,
} from "../types.js";
import { buildInboxUpgradeUrl } from "../url.js";

/** Build an {@link InboxEntries} — an array whose `.get` always hits the full registry. */
export function makeInboxEntries(
  list: InboxEntry[],
  get: (id: string) => InboxEntry | undefined,
): InboxEntries {
  const entries = list as InboxEntry[] & { get(id: string): InboxEntry | undefined };
  entries.get = get;
  return entries as InboxEntries;
}

const emptyInbox = (status: InboxStatus): InboxSnapshot => ({
  channels: makeInboxEntries([], () => undefined),
  items: [],
  counter: 0,
  status,
});

const byRecencyDesc = <T extends { at: number }>(a: T, b: T): number => b.at - a.at;

export interface InboxConnectionDeps {
  hosts: ResolvedHosts;
  apiKey: string;
  credentials: Credentials;
}

/**
 * Owns the inbox socket and its stores (conversation rows, targeted items, the badge
 * counter). Mirrors {@link ChannelConnection} but for the inbox family of frames.
 *
 * Anonymous tokens have no inbox: the upgrade is refused with `anonymous_not_allowed`, which
 * this swallows and replaces with a permanently-empty `ready` store, so callers need no
 * anonymous special-case.
 */
export class InboxConnection {
  readonly store = new Store<InboxSnapshot>(emptyInbox("connecting"));
  readonly events = new Emitter<InboxEvents>();

  readonly #deps: InboxConnectionDeps;
  #socket: Socket | undefined;
  #disposed = false;
  #tokenRetryUsed = false;
  /** Once synthesized for an anonymous token, the store stays empty and never reconnects. */
  #synthesized = false;

  readonly #entries = new Map<string, InboxEntryWire>();
  readonly #items = new Map<string, InboxItemWire>();
  #counter = 0;
  readonly #keepalive = new Keepalive(() => {
    const ping: PingFrame = { t: "ping" };
    this.#socket?.send(serializeFrame(ping));
  });

  constructor(deps: InboxConnectionDeps) {
    this.#deps = deps;
  }

  // ── Lifecycle ─────────────────────────────────────────────

  connect(): void {
    if (this.#socket !== undefined || this.#synthesized) return;
    this.#disposed = false;
    this.#tokenRetryUsed = false;
    this.#socket = getSocketFactory()({ url: this.#buildUrl, onEvent: this.#onEvent });
  }

  teardown(): void {
    this.#disposed = true;
    this.#keepalive.stop();
    this.#socket?.close();
    this.#socket = undefined;
    this.#entries.clear();
    this.#items.clear();
    this.#counter = 0;
    this.#synthesized = false;
    this.store.set(emptyInbox("connecting"));
  }

  /**
   * Re-authenticate after an identity change (login/logout): drop the current session and
   * reconnect so the inbox reflects the new user — including re-synthesizing an empty inbox
   * when the new identity is anonymous.
   */
  reauthenticate(): void {
    this.teardown();
    this.connect();
  }

  readonly #buildUrl = async (): Promise<string> => {
    const token = await this.#deps.credentials.resolve();
    return buildInboxUpgradeUrl({
      realtimeUrl: this.#deps.hosts.realtimeUrl,
      token,
      apiKey: this.#deps.apiKey,
    });
  };

  // ── Event handling ────────────────────────────────────────

  readonly #onEvent = (event: SocketEvent): void => {
    if (this.#disposed) return;
    switch (event.type) {
      case "open":
        this.#keepalive.start();
        return;
      case "message":
        this.#onMessage(event.data);
        return;
      case "refused":
        this.#onRefused(event.code, event.reason);
        return;
      case "closed":
        this.#keepalive.stop();
        if (!this.#synthesized) this.#setStatus("reconnecting");
        return;
      case "error":
        return;
    }
  };

  #onMessage(raw: string): void {
    const frame = parseInboxFrame(raw);
    if (frame === null) return;
    if (isInboxReady(frame)) {
      this.#entries.clear();
      this.#items.clear();
      for (const entry of frame.entries) this.#entries.set(entry.id, entry);
      for (const item of frame.items) this.#items.set(item.id, item);
      this.#counter = frame.counter;
      // A healthy session regains its one token-refresh retry, so a later expiry is not fatal.
      this.#tokenRetryUsed = false;
      this.#publishState("ready");
      return;
    }
    if (isInboxEntry(frame)) {
      this.#entries.set(frame.entry.id, frame.entry);
      this.#publishState();
      return;
    }
    if (isInboxItem(frame)) {
      // The item id is the idempotency key; a redelivered id updates state but is not a new
      // arrival, so the `item` event fires only the first time an id is seen.
      const isNew = !this.#items.has(frame.item.id);
      this.#items.set(frame.item.id, frame.item);
      this.#publishState();
      if (isNew) this.events.emit("item", this.#toItem(frame.item));
      return;
    }
    if (isInboxCounter(frame)) {
      this.#counter = frame.n;
      this.#publishState();
      return;
    }
    // pong: keepalive, not modeled.
  }

  #onRefused(code: string, reason?: string): void {
    if (code === "anonymous_not_allowed") {
      this.#synthesize();
      return;
    }
    const decision = classifyRefusal(code, reason);
    if (decision.kind === "token-expired") {
      const credentials = this.#deps.credentials;
      // Anonymous mode: the SDK owns the credential — re-mint (same anonId) and retry.
      // A rotating callback token likewise recovers: refresh once immediately. Either way,
      // bound it to one retry and then fall back to backoff reconnection.
      if (credentials.managed || !credentials.userStatic) {
        if (this.#tokenRetryUsed) {
          this.#setStatus("reconnecting");
        } else {
          this.#tokenRetryUsed = true;
          if (credentials.managed) credentials.invalidate();
          this.#socket?.reconnect();
        }
        return;
      }
      // A static string token cannot be re-resolved: fall through to terminal handling.
    }
    // Terminal and unrecoverable (bad key, banned, unsupported version, an invalid or
    // static-expired token). The transport keeps reconnecting until closed, so stop rather
    // than hammering. The inbox status has no terminal value and no error event, so this is
    // not surfaced through the inbox itself; in a typical app it surfaces on the channel
    // socket, which shares these credentials. An inbox-only app cannot observe it.
    this.#keepalive.stop();
    this.#socket?.close();
  }

  /** Replace the store with a permanently-empty, ready inbox for an anonymous token. */
  #synthesize(): void {
    this.#synthesized = true;
    this.#keepalive.stop();
    this.#socket?.close();
    this.#socket = undefined;
    this.store.set(emptyInbox("ready"));
    this.events.emit("change");
  }

  // ── Read + mute actions (two read models) ─────────────────

  /** Advance the inbox position for one channel — clears its badge (§5). */
  markEntryRead(channelId: string): void {
    const entry = this.#entries.get(channelId);
    if (entry !== undefined) this.#entries.set(channelId, { ...entry, unread: 0 });
    const frame: InboxReadFrame = { t: "read", channelId };
    this.#socket?.send(serializeFrame(frame));
    this.#publishState();
  }

  /** Flip one item's read flag (§5) — never cascades. */
  markItemRead(id: string): void {
    const item = this.#items.get(id);
    if (item !== undefined) this.#items.set(id, { ...item, read: true });
    const frame: InboxItemReadFrame = { t: "item.read", id };
    this.#socket?.send(serializeFrame(frame));
    this.#publishState();
  }

  /** Mark every item read (§5) — global, zero-arg. */
  markAllRead(): void {
    for (const [id, item] of this.#items) this.#items.set(id, { ...item, read: true });
    const frame: InboxReadAllFrame = { t: "read.all" };
    this.#socket?.send(serializeFrame(frame));
    this.#publishState();
  }

  /** Set the durable per-channel mute preference (§5). */
  setMute(channelId: string, muted: boolean): void {
    const entry = this.#entries.get(channelId);
    if (entry !== undefined) this.#entries.set(channelId, { ...entry, muted });
    const frame: InboxMuteFrame = { t: "mute", channelId, muted };
    this.#socket?.send(serializeFrame(frame));
    this.#publishState();
  }

  // ── Snapshot ──────────────────────────────────────────────

  #publishState(status?: InboxStatus): void {
    const publicEntries = [...this.#entries.values()]
      .sort(byRecencyDesc)
      .map((wire) => this.#toEntry(wire));
    const registry = new Map(publicEntries.map((entry) => [entry.id, entry]));
    const items = [...this.#items.values()].sort(byRecencyDesc).map((w) => this.#toItem(w));

    this.store.set({
      channels: makeInboxEntries(publicEntries, (id) => registry.get(id)),
      items,
      counter: this.#counter,
      status: status ?? this.store.getSnapshot().status,
    });
    this.events.emit("change");
  }

  #toEntry(wire: InboxEntryWire): InboxEntry {
    return {
      id: wire.id,
      ...(wire.name !== undefined ? { name: wire.name } : {}),
      ...(wire.meta !== undefined ? { meta: wire.meta } : {}),
      ...(wire.latest !== undefined ? { latest: wire.latest } : {}),
      unread: wire.unread,
      muted: wire.muted,
      at: wire.at,
      markAsRead: () => this.markEntryRead(wire.id),
      mute: () => this.setMute(wire.id, true),
      unmute: () => this.setMute(wire.id, false),
    };
  }

  #toItem(wire: InboxItemWire): InboxItem {
    return {
      id: wire.id,
      type: wire.type,
      ...(wire.title !== undefined ? { title: wire.title } : {}),
      data: wire.data,
      ...(wire.channelId !== undefined ? { channelId: wire.channelId } : {}),
      at: wire.at,
      read: wire.read,
      markAsRead: () => this.markItemRead(wire.id),
    };
  }

  #setStatus(status: InboxStatus): void {
    const current = this.store.getSnapshot().status;
    if (current === status) return;
    this.store.update((prev) => ({ ...prev, status }));
    this.events.emit("change");
  }
}
