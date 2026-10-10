import type { FluxyChatRoomConnection } from "./room-connection";
import { fluxySubscription, type FluxySubscription } from "./fluxy-subscription";

export const TYPING_HEARTBEAT_MS = 10_000;
/** CHA-T10 default: min interval between outbound typing.started. */
export const TYPING_THROTTLE_MS = 10_000;

export interface FluxyTypingChange {
  userId: string;
  clientId: string;
  isTyping: boolean;
  type: "typing.started" | "typing.stopped";
}

export interface FluxyTypingSetEvent {
  type: "typing.set.changed";
  currentlyTyping: Set<string>;
  change: FluxyTypingChange;
}

export interface FluxyTypingMember {
  userId: string;
  clientId: string;
}

/** Ably typing.current is a Set getter; we also keep `current()`. */
export type FluxyTypingCurrent = (() => Set<string>) & Set<string>;

export function typingCurrentFn(read: () => Set<string>): FluxyTypingCurrent {
  const fn = (() => read()) as FluxyTypingCurrent;
  return new Proxy(fn, {
    get(target, prop, receiver) {
      const set = read();
      if (prop === "size") return set.size;
      if (
        prop === "has" ||
        prop === "values" ||
        prop === "keys" ||
        prop === "entries" ||
        prop === "forEach" ||
        prop === Symbol.iterator
      ) {
        const value = Reflect.get(set, prop);
        return typeof value === "function" ? value.bind(set) : value;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export interface FluxyRoomTyping {
  /** Stream `channel.keystroke(parent_id?)`. */
  keystroke(parentId?: number | null): void;
  start(parentId?: number | null): void;
  stop(parentId?: number | null): void;
  current: FluxyTypingCurrent;
  currentTypers(): FluxyTypingMember[];
  subscribe(handler: (event: FluxyTypingSetEvent) => void): FluxySubscription;
}

export function bindRoomTyping(connection: FluxyChatRoomConnection): FluxyRoomTyping {
  const currently = new Set<string>();
  const listeners = new Set<(event: FluxyTypingSetEvent) => void>();
  let lastSentAt = 0;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  function emit(change: FluxyTypingChange) {
    const event: FluxyTypingSetEvent = {
      type: "typing.set.changed",
      currentlyTyping: new Set(currently),
      change,
    };
    for (const handler of listeners) handler(event);
  }

  connection.onAnyEvent((event) => {
    if (event.type !== "typing") return;
    const userId = String(event.userId || "").trim();
    if (!userId) return;
    const threadId = Number((event as { parentId?: unknown }).parentId);
    if (Number.isFinite(threadId) && threadId >= 1) return;
    const isTyping = Boolean(event.isTyping);
    if (isTyping) currently.add(userId);
    else currently.delete(userId);
    emit({
      userId,
      clientId: userId,
      isTyping,
      type: isTyping ? "typing.started" : "typing.stopped",
    });
  });

  function clearStopTimer() {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
  }

  return {
    keystroke(parentId?: number | null) {
      const now = Date.now();
      const throttle =
        typeof connection.typingHeartbeatThrottleMs === "number"
          ? connection.typingHeartbeatThrottleMs
          : TYPING_THROTTLE_MS;
      if (now - lastSentAt >= throttle) {
        lastSentAt = now;
        connection.sendTyping(true, parentId);
      }
      clearStopTimer();
      stopTimer = setTimeout(() => {
        stopTimer = null;
        lastSentAt = 0;
        connection.sendTyping(false, parentId);
      }, Math.max(TYPING_HEARTBEAT_MS, throttle) + Math.max(throttle, 1));
    },
    start(parentId?: number | null) {
      this.keystroke(parentId);
    },
    stop(parentId?: number | null) {
      clearStopTimer();
      lastSentAt = 0;
      connection.sendTyping(false, parentId);
    },
    current: typingCurrentFn(() => new Set(currently)),
    currentTypers() {
      return [...currently].map((userId) => ({ userId, clientId: userId }));
    },
    subscribe(handler) {
      listeners.add(handler);
      return fluxySubscription(() => {
        listeners.delete(handler);
      });
    },
  };
}
