import { verifyJwtAndGetContext } from "../lib/jwt-request.js";
import { logInfo, logError } from "../lib/worker-log.js";
import { WsSessionRegistry, installWsAutoResponse } from "../lib/do-ws-sessions.js";

/**
 * Per-user fan-out channel. DO id scope: one instance per project user
 * (`idFromName(projectId + "__" + userId)`).
 *
 * This object is the worst possible case for non-hibernating WebSockets: it is a
 * low-traffic notification channel that a user keeps open for hours. Accepting
 * with `webSocket.accept()` would bill Durable Object duration (128 MB x
 * wall-clock seconds) for that entire idle window, per user. It is accepted
 * through the Hibernation API instead, so an idle channel costs nothing.
 */
export class UserDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    this.sessions = new WsSessionRegistry(state, {
      onAttachmentOverflow: ({ bytes, field }) =>
        logError("user_do.ws_attachment_overflow", new Error("attachment budget exceeded"), {
          bytes,
          field,
        }),
    });
    /** Live sockets, derived from `state.getWebSockets()` so a wake sees them all. */
    this.clients = this.sessions.socketSet();
    /** @type {Map<WebSocket, string>} per-socket id, attachment field `s` */
    this.socketIds = this.sessions.field("s");
    this.projectId = null;
    this.userId = null;

    // Answered by the runtime without waking this object.
    this.autoResponseInstalled = installWsAutoResponse(state);

    if (typeof state?.blockConcurrencyWhile === "function" && state.storage) {
      this._hydrated = state.blockConcurrencyWhile(async () => {
        const [projectId, userId] = await Promise.all([
          state.storage.get("projectId"),
          state.storage.get("userId"),
        ]);
        if (typeof projectId === "string" && projectId) this.projectId = projectId;
        if (typeof userId === "string" && userId) this.userId = userId;
      });
    } else {
      this._hydrated = Promise.resolve();
    }
  }

  async ensureHydrated() {
    await this._hydrated;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleWebSocket(server, request);
      return new Response(null, { status: 101, webSocket: client });
    }

    await this.ensureHydrated();
    const url = new URL(request.url);
    if (url.pathname === "/deliver" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return Response.json({ error: "name_required" }, { status: 400 });
      }
      const excludeSocketId =
        typeof body.excludeSocketId === "string" && body.excludeSocketId
          ? body.excludeSocketId
          : typeof body.socket_id === "string" && body.socket_id
            ? body.socket_id
            : null;
      const targetUserId =
        typeof body.userId === "string" && body.userId
          ? body.userId
          : this.userId || this.state.id.toString().split("__").pop();

      const payload = {
        type: "user_event",
        userId: targetUserId,
        name,
        data: body.data ?? {},
        at: new Date().toISOString(),
      };

      const delivered = this.broadcast(payload, { excludeSocketId });
      return Response.json({ ok: true, delivered });
    }

    if (url.pathname === "/terminate" && request.method === "POST") {
      let body = {};
      try {
        body = await request.json();
      } catch {
        /* empty body ok */
      }
      const code = Number(body.code) || 4001;
      const reason =
        typeof body.reason === "string" && body.reason
          ? body.reason.slice(0, 120)
          : "terminated";
      const closed = this.terminateAllConnections(code, reason);
      return Response.json({ ok: true, closed });
    }

    return new Response("Unsupported user DO request", { status: 400 });
  }

  async handleWebSocket(webSocket, request) {
    this.sessions.accept(webSocket, []);
    const auth = await verifyJwtAndGetContext(request, this.env).catch((err) => {
      logError("user_do.ws_jwt_verify_failed", err, {});
      return null;
    });
    if (!auth) {
      webSocket.close(1008, "Unauthorized");
      return;
    }

    const pathUserId = this.userIdFromRequest(request);
    if (!pathUserId || pathUserId !== auth.userId) {
      webSocket.close(1008, "Forbidden");
      return;
    }

    this.projectId = auth.projectId;
    this.userId = auth.userId;
    // Persist the channel identity: `/deliver` can arrive on a woken object that
    // never ran a handshake in this isolate.
    if (this.state.storage) {
      try {
        await this.state.storage.put({ projectId: auth.projectId, userId: auth.userId });
      } catch (err) {
        logError("user_do.persist_identity_failed", err, { userId: auth.userId });
      }
    }

    const socketId = crypto.randomUUID();
    this.sessions.write(webSocket, { s: socketId, u: auth.userId, p: auth.projectId });

    logInfo("user_do.connected", {
      userId: auth.userId,
      projectId: auth.projectId,
      clients: this.clients.size,
      hibernatable: this.sessions.hibernationEnabled,
    });

    webSocket.send(
      JSON.stringify({
        type: "user_subscription_succeeded",
        userId: auth.userId,
        socketId,
        connectionCount: this.clients.size,
      }),
    );
  }

  // ── WebSocket Hibernation API handlers ────────────────────────────────────

  /**
   * This channel is push-only; inbound frames other than the runtime-handled
   * ping are ignored rather than parsed, keeping the wake path cheap.
   * @param {WebSocket} webSocket
   * @param {string | ArrayBuffer} message
   */
  async webSocketMessage(webSocket, message) {
    await this.ensureHydrated();
    if (typeof message !== "string") return;
    let frame;
    try {
      frame = JSON.parse(message);
    } catch {
      return;
    }
    // Kept for clients that predate the runtime auto-responder.
    if (frame?.type === "ping") {
      try {
        webSocket.send(JSON.stringify({ type: "pong" }));
      } catch {
        /* socket already gone */
      }
    }
  }

  /** @param {WebSocket} webSocket */
  async webSocketClose(webSocket) {
    await this.ensureHydrated();
    this.onClose(webSocket);
  }

  /**
   * @param {WebSocket} webSocket
   * @param {unknown} error
   */
  async webSocketError(webSocket, error) {
    await this.ensureHydrated();
    logError("user_do.ws_error", error instanceof Error ? error : new Error(String(error)), {
      userId: this.userId || undefined,
    });
    this.onClose(webSocket);
  }

  userIdFromRequest(request) {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("user");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return null;
    } catch {
      return null;
    }
  }

  onClose(webSocket) {
    this.sessions.forget(webSocket);
  }

  /**
   * @param {number} code
   * @param {string} reason
   * @returns {number}
   */
  terminateAllConnections(code = 4001, reason = "terminated") {
    const sockets = [...this.clients];
    let closed = 0;
    for (const ws of sockets) {
      try {
        ws.close(code, reason);
        closed += 1;
      } catch {
        /* ignore */
      }
      this.onClose(ws);
    }
    return closed;
  }

  /**
   * @param {Record<string, unknown>} message
   * @param {{ excludeSocketId?: string }} [options]
   * @returns {number} clients that received the payload
   */
  broadcast(message, options = {}) {
    const payload = JSON.stringify(message);
    const excludeSocketId = options.excludeSocketId;
    let delivered = 0;
    const dead = [];
    for (const client of this.clients) {
      if (excludeSocketId) {
        const sid = this.socketIds.get(client);
        if (sid === excludeSocketId) continue;
      }
      try {
        client.send(payload);
        delivered += 1;
      } catch {
        dead.push(client);
      }
    }
    for (const client of dead) {
      this.onClose(client);
    }
    return delivered;
  }
}
