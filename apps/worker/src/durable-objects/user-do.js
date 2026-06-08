import { verifyJwtAndGetContext } from "../lib/jwt-request.js";
import { logInfo } from "../lib/worker-log.js";

/** DO id scope: one instance per project user (`idFromName(projectId + "__" + userId)`). */
export class UserDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Set();
    /** @type {Map<WebSocket, string>} */
    this.socketIds = new Map();
    this.projectId = null;
    this.userId = null;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleWebSocket(server, request);
      return new Response(null, { status: 101, webSocket: client });
    }

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
    webSocket.accept();
    const auth = await verifyJwtAndGetContext(request, this.env).catch((err) => {
      console.error("UserDurableObject JWT verify error", err);
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
    this.clients.add(webSocket);
    const socketId = crypto.randomUUID();
    this.socketIds.set(webSocket, socketId);

    logInfo("user_do.connected", {
      userId: auth.userId,
      projectId: auth.projectId,
      clients: this.clients.size,
    });

    webSocket.addEventListener("close", () => this.onClose(webSocket));
    webSocket.addEventListener("error", () => this.onClose(webSocket));

    webSocket.send(
      JSON.stringify({
        type: "user_subscription_succeeded",
        userId: auth.userId,
        socketId,
        connectionCount: this.clients.size,
      }),
    );
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
    this.clients.delete(webSocket);
    this.socketIds.delete(webSocket);
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
