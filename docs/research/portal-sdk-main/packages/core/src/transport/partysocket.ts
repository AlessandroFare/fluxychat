import { WebSocket as ReconnectingWebSocket } from "partysocket";

import { upgradeUrlToHttpProbe } from "../url.js";
import { PORTAL_ERROR_HEADER } from "@portalsdk/wire-protocol";
import type { Socket, SocketFactory, SocketInit } from "./types.js";

/**
 * Reconnect/backoff policy for the wrapped socket. Transient drops reconnect
 * indefinitely with growing backoff; a terminal refusal is stopped by the manager via
 * `close()`.
 */
const RECONNECT_OPTIONS = {
  minReconnectionDelay: 1_000,
  maxReconnectionDelay: 30_000,
  reconnectionDelayGrowFactor: 1.5,
  connectionTimeout: 10_000,
  minUptime: 5_000,
  maxRetries: Number.POSITIVE_INFINITY,
} as const;

/**
 * Recover a refusal code from a failed upgrade.
 *
 * A browser WebSocket cannot read the HTTP 4xx that carries the refusal (§1.1), so we
 * re-issue the request over HTTP and read the `x-portal-error` header (or the body's
 * `code`). A network error or a non-refusal response means "transient" — resolves `null`.
 */
async function probeRefusal(
  wsUrl: string,
): Promise<{ code: string; reason?: string } | null> {
  let response: Response;
  try {
    response = await fetch(upgradeUrlToHttpProbe(wsUrl), { method: "GET" });
  } catch {
    return null;
  }
  if (response.ok) return null;

  const header = response.headers.get(PORTAL_ERROR_HEADER);
  if (header) {
    const reason = await readReason(response);
    return reason === undefined ? { code: header } : { code: header, reason };
  }
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      typeof (body as { code?: unknown }).code === "string"
    ) {
      const { code, reason } = body as { code: string; reason?: string };
      return reason === undefined ? { code } : { code, reason };
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function readReason(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    const reason = (body as { reason?: unknown }).reason;
    return typeof reason === "string" ? reason : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Production {@link SocketFactory}, wrapping `partysocket` (pinned; never exposed in
 * public types). The URL provider is re-invoked per attempt so credentials and the
 * `leaf`/`last=` reconnect hints are always current.
 */
export const createPartySocketTransport: SocketFactory = (init: SocketInit): Socket => {
  const rws = new ReconnectingWebSocket(init.url, [], RECONNECT_OPTIONS);
  let openNow = false;
  let closedByUs = false;

  rws.addEventListener("open", () => {
    openNow = true;
    init.onEvent({ type: "open" });
  });

  rws.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      init.onEvent({ type: "message", data: event.data });
    }
  });

  rws.addEventListener("close", () => {
    if (closedByUs) return;
    const wasOpen = openNow;
    openNow = false;
    if (wasOpen) {
      init.onEvent({ type: "closed" });
      return;
    }
    // Failed to open this attempt: could be a refusal or a transient network error.
    void probeRefusal(rws.url).then((refusal) => {
      if (closedByUs) return;
      init.onEvent(
        refusal === null
          ? { type: "closed" }
          : refusal.reason === undefined
            ? { type: "refused", code: refusal.code }
            : { type: "refused", code: refusal.code, reason: refusal.reason },
      );
    });
  });

  return {
    send: (data: string): void => {
      rws.send(data);
    },
    reconnect: (): void => {
      rws.reconnect();
    },
    close: (): void => {
      closedByUs = true;
      rws.close();
    },
  };
};
