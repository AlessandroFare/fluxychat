import { InboxConnection, makeInboxEntries } from "./connection.js";
import type {
  InboxEntries,
  InboxEntry,
  InboxEvents,
  InboxHandle,
  InboxItem,
  InboxQuery,
  InboxSnapshot,
  InboxStatus,
  InboxView,
  Unsubscribe,
} from "../types.js";
import { matchesWhere } from "../where.js";

/** Flatten an item to the record its `where` matches against — envelope fields win (§6). */
function itemRecord(item: InboxItem, entry: InboxEntry | undefined): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  if (typeof item.data === "object" && item.data !== null) {
    for (const [key, value] of Object.entries(item.data)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        record[key] = value;
      }
    }
  }
  record["type"] = item.type;
  record["channelId"] = item.channelId;
  record["read"] = item.read;
  record["muted"] = entry?.muted ?? false;
  return record;
}

interface ViewSnapshot<D> {
  channels: InboxEntries;
  items: readonly InboxItem<D>[];
  unseen: number;
}

/**
 * A filtered lens over the inbox stores (§6). `channelId` scopes the whole view; `where`
 * filters the item feed.
 *
 * SPEC: `InboxWhere` spans item fields (`type`, `read`) and an entry field (`muted`). The
 * view applies `where` to items — joining `muted` from each item's channel row — and scopes
 * `channels` by `channelId` only; §6 does not define a channel-level predicate, and applying
 * an item predicate to rows (which have no `type`/`read`) is ill-defined.
 */
class InboxViewImpl<D> implements InboxView<D> {
  readonly #connection: InboxConnection;
  readonly #query: InboxQuery<D>;
  #source: InboxSnapshot | undefined;
  #derived: ViewSnapshot<D> | undefined;

  constructor(connection: InboxConnection, query: InboxQuery<D>) {
    this.#connection = connection;
    this.#query = query;
  }

  get channels(): InboxEntries {
    return this.#compute().channels;
  }
  get items(): readonly InboxItem<D>[] {
    return this.#compute().items;
  }
  get unseen(): number {
    return this.#compute().unseen;
  }

  on<E extends keyof InboxEvents>(event: E, fn: InboxEvents[E]): Unsubscribe {
    return this.#connection.events.on(event, fn);
  }
  subscribe(listener: () => void): Unsubscribe {
    return this.#connection.store.subscribe(listener);
  }
  getSnapshot(): ViewSnapshot<D> {
    return this.#compute();
  }

  /** Recompute only when the underlying store changed, so the snapshot stays referentially stable. */
  #compute(): ViewSnapshot<D> {
    const source = this.#connection.store.getSnapshot();
    if (source === this.#source && this.#derived !== undefined) return this.#derived;

    const { channelId, where } = this.#query;
    const fullGet = source.channels.get;
    const channels = source.channels.filter((e) => channelId === undefined || e.id === channelId);
    const items = source.items.filter((item) => {
      if (channelId !== undefined && item.channelId !== channelId) return false;
      if (where === undefined) return true;
      const entry = item.channelId !== undefined ? fullGet(item.channelId) : undefined;
      return matchesWhere(itemRecord(item, entry), where as Record<string, never>);
    }) as readonly InboxItem<D>[];

    this.#source = source;
    this.#derived = {
      channels: makeInboxEntries(channels, fullGet),
      items,
      unseen: items.filter((i) => !i.read).length,
    };
    return this.#derived;
  }
}

/**
 * The inbox handle — a thin, reactive shell over the {@link InboxConnection}. There is one
 * per Portal (a lazy singleton), so it is not refcounted like a channel.
 */
export class InboxHandleImpl implements InboxHandle {
  readonly #connection: InboxConnection;

  constructor(connection: InboxConnection) {
    this.#connection = connection;
  }

  get channels(): InboxEntries {
    return this.#connection.store.getSnapshot().channels;
  }
  get items(): readonly InboxItem[] {
    return this.#connection.store.getSnapshot().items;
  }
  get counter(): number {
    return this.#connection.store.getSnapshot().counter;
  }
  get status(): InboxStatus {
    return this.#connection.store.getSnapshot().status;
  }

  view<D = unknown>(query: InboxQuery<D>): InboxView<D> {
    return new InboxViewImpl<D>(this.#connection, query);
  }

  markAllRead(): void {
    this.#connection.markAllRead();
  }

  /**
   * Internal: re-authenticate the inbox after an identity change. Not part of the public
   * {@link InboxHandle} contract — only the owning Portal calls it.
   */
  reauthenticate(): void {
    this.#connection.reauthenticate();
  }

  on<E extends keyof InboxEvents>(event: E, fn: InboxEvents[E]): Unsubscribe {
    return this.#connection.events.on(event, fn);
  }

  subscribe(listener: () => void): Unsubscribe {
    return this.#connection.store.subscribe(listener);
  }

  getSnapshot(): InboxSnapshot {
    return this.#connection.store.getSnapshot();
  }
}
