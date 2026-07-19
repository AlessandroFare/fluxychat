import { vi } from "vitest";

import {
  NotYetSupportedError,
  type ChannelEvents,
  type ChannelHandle,
  type ChannelSnapshot,
  type Portal,
} from "@portalsdk/core";

/**
 * A fake {@link ChannelHandle} implementing core's *public* contract with spies and a
 * controllable store. The react bindings are a thin layer over this contract, so testing the
 * binding logic (refcount, subscription, readOn, callback mapping) against a fake at the
 * public boundary is both precise and exactly the "consume core as a customer" altitude.
 */
export interface FakeChannel<M = unknown> {
  handle: ChannelHandle<M>;
  /** Replace the snapshot and notify subscribers (referentially new object, as core does). */
  setSnapshot(patch: Partial<ChannelSnapshot<M>>): void;
  /** Emit a channel event to registered `on` listeners. */
  emit<E extends keyof ChannelEvents<M>>(
    event: E,
    ...args: Parameters<ChannelEvents<M>[E]>
  ): void;
}

function defaultSnapshot<M>(): ChannelSnapshot<M> {
  return {
    messages: [],
    presence: undefined,
    activity: [],
    status: "connecting",
    unread: 0,
    info: undefined,
    me: undefined,
    isLoadingPrevious: false,
    hasPrevious: true,
  };
}

export function makeFakeChannel<M = unknown>(): FakeChannel<M> {
  let snapshot = defaultSnapshot<M>();
  const listeners = new Set<() => void>();
  const events = new Map<string, Set<(...args: never[]) => void>>();

  const handle: ChannelHandle<M> = {
    acquire: vi.fn(),
    release: vi.fn(),
    [Symbol.dispose]: vi.fn(),
    get messages() {
      return snapshot.messages;
    },
    send: vi.fn(async () => ({ id: "ack", timestamp: 0 })),
    loadPrevious: vi.fn(async () => false),
    get isLoadingPrevious() {
      return snapshot.isLoadingPrevious;
    },
    get hasPrevious() {
      return snapshot.hasPrevious;
    },
    // Reserved surface: core throws for a channel `where`. The fake mirrors that.
    view: vi.fn(() => {
      throw new NotYetSupportedError("channel where is reserved");
    }),
    get presence() {
      return snapshot.presence;
    },
    get activity() {
      return snapshot.activity;
    },
    sendActivity: vi.fn(),
    get typing() {
      return [];
    },
    sendTyping: vi.fn(),
    get unread() {
      return snapshot.unread;
    },
    markAsRead: vi.fn(),
    get info() {
      return snapshot.info;
    },
    get me() {
      return snapshot.me;
    },
    members: vi.fn(async () => []),
    setMetadata: vi.fn(),
    get status() {
      return snapshot.status;
    },
    on: vi.fn(<E extends keyof ChannelEvents<M>>(event: E, fn: ChannelEvents<M>[E]) => {
      let set = events.get(event as string);
      if (!set) {
        set = new Set();
        events.set(event as string, set);
      }
      set.add(fn as (...args: never[]) => void);
      return () => {
        set?.delete(fn as (...args: never[]) => void);
      };
    }),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };

  return {
    handle,
    setSnapshot(patch) {
      snapshot = { ...snapshot, ...patch };
      for (const l of listeners) l();
    },
    emit(event, ...args) {
      const set = events.get(event as string);
      if (set) for (const fn of set) (fn as (...a: unknown[]) => void)(...args);
    },
  };
}

export interface FakePortal {
  portal: Portal;
  /** The fake channel for an id (created on first `channel(id)`), or undefined if never asked. */
  channel(id: string): FakeChannel | undefined;
}

export function makeFakePortal(): FakePortal {
  const channels = new Map<string, FakeChannel>();
  const portal = {
    // Registry semantics: same handle per id.
    channel: vi.fn((id: string) => {
      let fake = channels.get(id);
      if (!fake) {
        fake = makeFakeChannel();
        channels.set(id, fake);
      }
      return fake.handle;
    }),
    inbox: vi.fn(),
  } as unknown as Portal;

  return { portal, channel: (id) => channels.get(id) };
}
