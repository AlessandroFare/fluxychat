import type { FluxyChatClient } from "./index";
import { decodeFluxyJwtPayload, jwtRefreshDelayMs } from "./jwt-utils";

export interface SessionTokenRefreshOptions {
  /** Refresh this many ms before JWT `exp` (default 5 minutes). */
  bufferMs?: number;
  /** Called before expiry to resolve a fresh token and reconnect transports. */
  onRefresh: () => void | Promise<void>;
}

/**
 * Schedule proactive JWT refresh for long-lived room sessions.
 * Returns a disposer; safe to call when token has no `exp` (no-op timer).
 */
export function scheduleSessionTokenRefresh(
  client: FluxyChatClient,
  options: SessionTokenRefreshOptions,
): () => void {
  const bufferMs = options.bufferMs ?? 5 * 60_000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  function arm() {
    if (cancelled) return;
    const token = client.token;
    if (!token) return;
    const { exp } = decodeFluxyJwtPayload(token);
    if (!exp) return;
    let delay = jwtRefreshDelayMs(exp, bufferMs);
    if (delay <= 0) {
      delay = 30_000;
    }
    timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await client.resolveToken?.();
        await options.onRefresh();
      } catch {
        /* caller may retry on auth error */
      }
      arm();
    }, delay);
  }

  arm();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/** Short fingerprint for session cache keys — changes when JWT rotates. */
export function sessionTokenFingerprint(token: string | null | undefined): string {
  if (!token?.trim()) return "none";
  const { exp } = decodeFluxyJwtPayload(token);
  return exp ? String(exp) : token.slice(-12);
}
