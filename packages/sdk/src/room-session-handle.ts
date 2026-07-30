/** Grace window between last release and session teardown (React StrictMode parity). */
export const FLUXY_ROOM_SESSION_GRACE_MS = 3_000;

interface SessionEntry {
  count: number;
  stop: (() => void) | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
}

const sessions = new Map<string, SessionEntry>();

interface SessionLeakHeld {
  sessionKey: string;
  label: string;
}

interface ReleaseToken {
  released: boolean;
}

type SessionFinalizationRegistry = {
  register(target: object, heldValue: SessionLeakHeld, unregisterToken?: object): void;
  unregister(unregisterToken: object): void;
};

function createSessionFinalizationRegistry(): SessionFinalizationRegistry | null {
  const Registry = (
    globalThis as typeof globalThis & {
      FinalizationRegistry?: new <T>(callback: (heldValue: T) => void) => SessionFinalizationRegistry;
    }
  ).FinalizationRegistry;
  if (!Registry) return null;
  return new Registry<SessionLeakHeld>((held) => {
    if (sessions.has(held.sessionKey)) {
      console.warn(
        `[fluxy-chat] Room session "${held.sessionKey}" (${held.label}) was garbage-collected without release — possible leak.`,
      );
    }
  });
}

const sessionFinalizationRegistry =
  typeof process !== "undefined" && process.env?.NODE_ENV !== "production"
    ? createSessionFinalizationRegistry()
    : null;

/**
 * Refcounted room session lifecycle. First acquire starts `start()`; last release
 * tears down after {@link FLUXY_ROOM_SESSION_GRACE_MS}.
 */
export function acquireFluxyRoomSession(
  sessionKey: string,
  start: () => () => void,
  debugLabel = "useChat",
): () => void {
  let entry = sessions.get(sessionKey);
  if (!entry) {
    entry = { count: 0, stop: null, graceTimer: null };
    sessions.set(sessionKey, entry);
  }

  if (entry.graceTimer !== null) {
    clearTimeout(entry.graceTimer);
    entry.graceTimer = null;
  }

  entry.count += 1;
  if (entry.count === 1 && entry.stop === null) {
    entry.stop = start();
  }

  const token: ReleaseToken = { released: false };

  function release(): void {
    if (token.released) return;
    token.released = true;
    sessionFinalizationRegistry?.unregister(token);
    releaseFluxyRoomSession(sessionKey);
  }

  sessionFinalizationRegistry?.register(token, { sessionKey, label: debugLabel }, token);

  return release;
}

function releaseFluxyRoomSession(sessionKey: string): void {
  const entry = sessions.get(sessionKey);
  if (!entry || entry.count === 0) return;

  entry.count -= 1;
  if (entry.count > 0) return;

  entry.graceTimer = setTimeout(() => {
    entry.stop?.();
    entry.stop = null;
    entry.graceTimer = null;
    sessions.delete(sessionKey);
  }, FLUXY_ROOM_SESSION_GRACE_MS);
}

/** Test helper — reset global refcount state. */
export function resetFluxyRoomSessionHandlesForTests(): void {
  for (const entry of sessions.values()) {
    if (entry.graceTimer !== null) clearTimeout(entry.graceTimer);
    entry.stop?.();
  }
  sessions.clear();
}
