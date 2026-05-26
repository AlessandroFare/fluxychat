import { verifyJwtAndGetContext } from "../lib/jwt-request.js";
import { logInfo, logError } from "../lib/worker-log.js";
import { isRoomMember } from "../lib/room-access.js";
import { attachAttachmentsToMessages } from "../lib/messages-attachments.js";
import { checkAndConsumeProjectQuota } from "../lib/project-plan-quota.js";
import { validateMessageContent } from "../lib/message-validation.js";
import {
  quotaResetInfo,
  extractMentions,
  extractFirstUrl,
  fetchOgPreview,
} from "../lib/message-enrichment.js";
import { deliverWebhooks } from "../lib/webhook-delivery.js";
import { schedulePostMessageAutomations } from "../lib/post-message-automations.js";
import { invokeMentionedAgents } from "../lib/agent-runtime.js";
export class RoomDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Set();
    this.sseClients = new Set();
    this.moderationCache = new Map();
    this.userIds = new Map();
    this.projectId = null;
    this.roomId = null;
    this.wsRateLimitStore = new Map();
    /** @type {Map<string, { messageId: number, lastFlushMs: number }>} */
    this.activeStreams = new Map();

    if (typeof this.state.blockConcurrencyWhile === "function" && this.state.storage) {
      this._storageHydrated = this.state.blockConcurrencyWhile(async () => {
        const storedProjectId = await this.state.storage.get("projectId");
        const storedRoomId = await this.state.storage.get("roomId");
        if (typeof storedProjectId === "string" && storedProjectId) {
          this.projectId = storedProjectId;
        }
        if (typeof storedRoomId === "string" && storedRoomId) {
          this.roomId = storedRoomId;
        }
      });
    } else {
      this._storageHydrated = Promise.resolve();
    }
  }

  async ensureStorageHydrated() {
    await this._storageHydrated;
  }

  async persistRoomContext(projectId, roomId) {
    this.projectId = projectId;
    this.roomId = roomId;
    if (this.state.storage) {
      await this.state.storage.put("projectId", projectId);
      await this.state.storage.put("roomId", roomId);
    }
  }

  getRoomIdFromRequest(request) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/ws/room/")) {
        return url.pathname.split("/").pop() || null;
      }
      // For internal DO endpoints (/sse, /announce) we may not have a room id in the URL.
      return null;
    } catch {
      return null;
    }
  }

  async handleWebSocket(webSocket, request) {
    webSocket.accept();
    const auth = await verifyJwtAndGetContext(request, this.env).catch((err) => {
      console.error("RoomDurableObject JWT verify error", err);
      return null;
    });
    if (!auth) {
      webSocket.close(1008, "Unauthorized");
      return;
    }
    const roomId = this.getRoomIdFromRequest(request) || this.roomId || this.state.id.toString();
    await this.persistRoomContext(auth.projectId, roomId);
    const isMember = await isRoomMember(this.env, auth.projectId, roomId, auth.userId);
    if (!isMember) {
      webSocket.close(1008, "Forbidden");
      return;
    }

    this.clients.add(webSocket);
    logInfo("do.client_count", {
      roomId: this.state.id.toString(),
      wsClients: this.clients.size,
      sseClients: this.sseClients.size,
    });
    const userId = auth.userId;
    this.userIds.set(webSocket, userId);

    // Presence recovery: on DO wake after hibernation, reconstruct online user list
    // from D1 read_receipts so the presence broadcast reflects recent activity rather
    // than showing empty state. WebSocket connections themselves cannot be restored.
    let recentUsersRows = { results: [] };
    try {
      // Newer schema may have last_read_at; older schema only has created_at.
      recentUsersRows = await this.env.DB.prepare(
        "SELECT DISTINCT user_id FROM read_receipts WHERE room_id = ? AND project_id = ? ORDER BY last_read_at DESC LIMIT 100"
      )
        .bind(roomId, this.projectId)
        .all();
    } catch {
      recentUsersRows = await this.env.DB.prepare(
        "SELECT DISTINCT user_id FROM read_receipts WHERE room_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 100"
      )
        .bind(roomId, this.projectId)
        .all();
    }
    const recoveredUserIds = (recentUsersRows.results || []).map((r) => r.user_id).filter((uid) => uid !== userId);
    for (const uid of recoveredUserIds) {
      this.userIds.set(`recovered:${uid}`, uid);
    }

    webSocket.addEventListener("message", (event) =>
      this.onMessage(webSocket, event)
    );
    webSocket.addEventListener("close", () =>
      this.onClose(webSocket)
    );
    webSocket.addEventListener("error", () =>
      this.onClose(webSocket)
    );

    // Optionally restore recent history and send to new client
    const projectId = this.projectId;
    const result = await this.env.DB.prepare(
      "SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at, mentions, og_title, og_description, og_image, og_url, client_message_id FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50"
    )
      .bind(projectId, roomId)
      .all();

    const rows = result.results || [];
    const mapped = await attachAttachmentsToMessages(
      this.env,
      projectId,
      roomId,
      rows
    );

    webSocket.send(
      JSON.stringify({
        type: "history",
        messages: mapped.reverse(),
      })
    );

    this.broadcast({
      type: "presence",
      online: this.clients.size,
      users: Array.from(this.userIds.values()),
    });
  }

  async processStreamOp({ projectId, roomId, userId, op, content, messageId, parentId }) {
    const STREAM_FLUSH_MS = 180;
    if (!userId || !projectId) {
      return { ok: false, error: "stream_requires_project_and_user" };
    }

    this.projectId = projectId;
    this.roomId = roomId;

    if (op === "start") {
      if (this.activeStreams.has(userId)) {
        return { ok: false, error: "stream_already_active" };
      }

      const contentValidation = validateMessageContent(content ?? "");
      if (!contentValidation.valid) {
        return { ok: false, error: `invalid_content: ${contentValidation.error}` };
      }

      const moderation = await this.checkModeration(roomId, userId);
      if (moderation.banned || moderation.muted) {
        return {
          ok: false,
          error: moderation.banned
            ? "banned"
            : "muted",
        };
      }

      const quotaResult = await checkAndConsumeProjectQuota(this.env, {
        projectId,
        metricName: "messages_created",
        amount: 1,
      }).catch(() => ({ allowed: true }));
      if (!quotaResult.allowed) {
        return { ok: false, error: "quota_exceeded", details: quotaResult };
      }

      const createdAt = new Date().toISOString();
      const initialContent = contentValidation.content;
      const insert = await this.env.DB.prepare(
        "INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          projectId,
          roomId,
          userId,
          initialContent,
          createdAt,
          parentId ? Number(parentId) || null : null,
          null,
          null,
          null,
          null,
          null
        )
        .run();
      const newMessageId = insert.meta.last_row_id;
      this.activeStreams.set(userId, {
        messageId: newMessageId,
        lastFlushMs: Date.now(),
      });

      this.broadcast({
        type: "message",
        id: newMessageId,
        roomId,
        userId,
        senderId: userId,
        content: initialContent,
        createdAt,
        parentId: parentId ? Number(parentId) || null : null,
        mentions: [],
        preview: null,
        attachments: [],
        streaming: true,
      });

      return { ok: true, id: newMessageId };
    }

    if (op === "delta" || op === "end") {
      const state = this.activeStreams.get(userId);
      const mid = Number(messageId);
      if (!state || state.messageId !== mid) {
        return { ok: false, error: "stream_not_active" };
      }

      const contentValidation = validateMessageContent(content ?? "");
      if (!contentValidation.valid) {
        return { ok: false, error: `invalid_content: ${contentValidation.error}` };
      }

      const now = new Date().toISOString();
      const nextContent = contentValidation.content;
      const isFinal = op === "end";
      const shouldPersist =
        isFinal || Date.now() - state.lastFlushMs >= STREAM_FLUSH_MS;

      if (shouldPersist) {
        await this.env.DB.prepare(
          "UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND project_id = ? AND room_id = ? AND user_id = ?"
        )
          .bind(nextContent, now, mid, projectId, roomId, userId)
          .run();
        state.lastFlushMs = Date.now();
      }

      this.broadcast({
        type: "edit",
        id: mid,
        roomId,
        userId,
        content: nextContent,
        editedAt: now,
        streaming: !isFinal,
      });

      if (isFinal) {
        this.activeStreams.delete(userId);
        void schedulePostMessageAutomations(this.env, {
          projectId,
          roomId,
          authorUserId: userId,
          messageId: mid,
          content: nextContent,
          traceId: undefined,
        });
      }

      return { ok: true, id: mid };
    }

    if (op === "abort") {
      const state = this.activeStreams.get(userId);
      if (!state) {
        return { ok: false, error: "stream_not_active" };
      }
      const mid = state.messageId;
      const now = new Date().toISOString();
      await this.env.DB.prepare(
        "UPDATE messages SET deleted_at = ?, content = ? WHERE id = ? AND project_id = ? AND room_id = ? AND user_id = ?"
      )
        .bind(now, "[stream aborted]", mid, projectId, roomId, userId)
        .run();
      this.activeStreams.delete(userId);
      this.broadcast({
        type: "delete",
        id: mid,
        roomId,
        userId,
        deletedAt: now,
        hard: false,
      });
      return { ok: true, id: mid };
    }

    return { ok: false, error: "invalid_stream_op" };
  }

  async onMessage(webSocket, event) {
    let msg;
    try {
      msg = JSON.parse(event.data);

      if (msg.type === "ping") {
        webSocket.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        return;
      }

      if (msg.type === "message") {
        const roomId = this.roomId || this.state.id.toString();
        const { id, userId, content, parentId, attachments } = msg;

        // Validate message content before processing
        const contentValidation = validateMessageContent(content);
        if (!contentValidation.valid) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: `invalid_content: ${contentValidation.error}`,
            })
          );
          return;
        }
        const validatedContent = contentValidation.content;

        const quotaResult = await checkAndConsumeProjectQuota(this.env, {
          projectId: this.projectId,
          metricName: "messages_created",
          amount: 1,
        }).catch(() => ({ allowed: true }));
        if (!quotaResult.allowed) {
          const reset = quotaResetInfo();
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: "quota_exceeded",
              details: {
                metric: quotaResult.metricName,
                limit: quotaResult.limit,
                used: quotaResult.used,
                month: quotaResult.monthKey,
                resetsAt: reset.resetsAt,
                retryAfterSeconds: reset.retryAfterSeconds,
              },
            })
          );
          return;
        }
        const wsMessageRate = this.consumeWsRateLimit(
          `ws-msg:${this.projectId}:${roomId}:${userId}`,
          Number(this.env.RATE_LIMIT_WS_MESSAGES_PER_MINUTE || 60),
          60_000
        );
        if (!wsMessageRate.allowed) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: `rate_limit_exceeded: retry in ${wsMessageRate.retryAfterSeconds}s`,
            })
          );
          return;
        }

        const moderation = await this.checkModeration(roomId, userId);
        if (moderation.banned) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: "You have been banned from this room.",
            })
          );
          return;
        }

        if (moderation.muted) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: "You are muted and cannot send messages right now.",
            })
          );
          return;
        }

        const createdAt = new Date().toISOString();
        const projectId = this.projectId;
        const mentions = extractMentions(validatedContent);
        const firstUrl = extractFirstUrl(validatedContent);
        let preview = null;
        if (firstUrl && this.env.OG_PREVIEW_ENABLED !== "false") {
          preview = await fetchOgPreview(firstUrl, this.env);
        }

        let messageId = id;
        if (!messageId) {
          const result = await this.env.DB.prepare(
            "INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
            .bind(
              projectId,
              roomId,
              userId,
              validatedContent,
              createdAt,
              parentId || null,
              mentions.length ? JSON.stringify(mentions) : null,
              preview?.title || null,
              preview?.description || null,
              preview?.imageUrl || null,
              preview?.url || null
            )
            .run();
          messageId = result.meta.last_row_id;
        }

        if (Array.isArray(attachments) && attachments.length) {
          const stmts = attachments.map((a) =>
            this.env.DB.prepare(
              "INSERT INTO attachments (project_id, room_id, message_id, kind, url, name, size_bytes, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(
              projectId,
              roomId,
              messageId,
              a.kind || "file",
              a.url,
              a.name || a.url,
              a.sizeBytes ?? null,
              a.contentType ?? null,
              createdAt
            )
          );
          await this.env.DB.batch(stmts);
        }

        if (mentions.length) {
          const stmts = mentions.map((u) =>
            this.env.DB.prepare(
              "INSERT INTO message_mentions (project_id, room_id, message_id, mentioned_user_id, created_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(projectId, roomId, messageId, u, createdAt)
          );
          await this.env.DB.batch(stmts);

          await this.env.DB.prepare(
            "INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at) VALUES (?, ?, ?, ?, ?)"
          )
            .bind(
              projectId,
              "mention",
              roomId,
              JSON.stringify({
                fromUserId: userId,
                toUserIds: mentions,
                messageId,
              }),
              createdAt
            )
            .run();

          // Also deliver mention events to project webhooks (for AI agents / integrations)
          await deliverWebhooks(this.env, projectId, "mention", {
            roomId,
            fromUserId: userId,
            toUserIds: mentions,
            messageId,
            createdAt,
          }).catch((err) =>
            console.error("webhook mention error", err)
          );

          void invokeMentionedAgents(
            this.env,
            projectId,
            roomId,
            userId,
            validatedContent,
            mentions,
            undefined,
            parentId || null,
          ).catch((err) =>
            logError("agent.mention_invoke_error", err, { projectId, roomId }),
          );
        }

        const roomRow = await this.env.DB.prepare(
          "SELECT type FROM rooms WHERE project_id = ? AND id = ?"
        )
          .bind(projectId, roomId)
          .first();
        if (roomRow?.type === "dm") {
          await this.env.DB.prepare(
            "INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at) VALUES (?, ?, ?, ?, ?)"
          )
            .bind(
              projectId,
              "dm_message",
              roomId,
              JSON.stringify({
                fromUserId: userId,
                messageId,
              }),
              createdAt
            )
            .run();
        }

        const payload = {
          type: "message",
          id: messageId,
          roomId,
          userId,
          senderId: userId,
          content: validatedContent,
          createdAt,
          parentId: parentId || null,
          mentions,
          preview,
          attachments: Array.isArray(attachments) ? attachments : [],
        };

        this.broadcast(payload);

        void schedulePostMessageAutomations(this.env, {
          projectId,
          roomId,
          authorUserId: userId,
          messageId,
          content: validatedContent,
          traceId: undefined,
        });

        return;
      }

      if (msg.type === "stream") {
        const roomId = this.roomId || this.state.id.toString();
        const userId = this.userIds.get(webSocket) || msg.userId;
        const projectId = this.projectId;
        const op = String(msg.op || "");
        const parentId = msg.parentId ? Number(msg.parentId) || null : null;

        if (!userId || !projectId) {
          webSocket.send(
            JSON.stringify({ type: "error", message: "stream_requires_authenticated_socket" })
          );
          return;
        }

        const result = await this.processStreamOp({
          projectId,
          roomId,
          userId,
          op,
          content: msg.content,
          messageId: msg.messageId,
          parentId,
        });

        if (!result.ok) {
          const errorMessage =
            result.error === "banned"
              ? "You have been banned from this room."
              : result.error === "muted"
                ? "You are muted and cannot send messages right now."
                : result.error;
          webSocket.send(JSON.stringify({ type: "error", message: errorMessage, details: result.details }));
          return;
        }

        if (op === "start") {
          webSocket.send(
            JSON.stringify({ type: "stream", op: "started", id: result.id, roomId })
          );
        }
        return;
      }

      if (msg.type === "edit") {
        const roomId = this.roomId || this.state.id.toString();
        const { userId, messageId, content } = msg;
        const now = new Date().toISOString();

        await this.env.DB.prepare(
          "UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND room_id = ? AND user_id = ?"
        )
          .bind(content, now, messageId, roomId, userId)
          .run();

        const payload = {
          type: "edit",
          id: messageId,
          roomId,
          userId,
          content,
          editedAt: now,
          streaming: false,
        };
        this.broadcast(payload);
        return;
      }

      if (msg.type === "reaction") {
        const roomId = this.roomId || this.state.id.toString();
        const { userId, messageId, emoji, op } = msg;
        const now = new Date().toISOString();

        const projectId = this.projectId;
        if (op === "remove") {
          await this.env.DB.prepare(
            "DELETE FROM message_reactions WHERE project_id = ? AND message_id = ? AND room_id = ? AND user_id = ? AND emoji = ?"
          )
            .bind(projectId, messageId, roomId, userId, emoji)
            .run();
        } else {
          await this.env.DB.prepare(
            "INSERT INTO message_reactions (project_id, message_id, room_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
          )
            .bind(projectId, messageId, roomId, userId, emoji, now)
            .run();
        }

        const payload = {
          type: "reaction",
          roomId,
          userId,
          messageId,
          emoji,
          op: op || "add",
        };
        this.broadcast(payload);
        return;
      }

      if (msg.type === "read") {
        const roomId = this.roomId || this.state.id.toString();
        const { userId, messageId } = msg;
        const now = new Date().toISOString();

        const projectId = this.projectId;
        await this.env.DB.prepare(
          "INSERT OR IGNORE INTO read_receipts (project_id, room_id, user_id, message_id, created_at) VALUES (?, ?, ?, ?, ?)"
        )
          .bind(projectId, roomId, userId, messageId, now)
          .run();

        const payload = {
          type: "read",
          roomId,
          userId,
          messageId,
          createdAt: now,
        };
        this.broadcast(payload);
        return;
      }

      if (msg.type === "delete") {
        const roomId = this.roomId || this.state.id.toString();
        const userId = this.userIds.get(webSocket);
        if (!userId) return;
        const messageId = Number(msg.messageId);
        if (!Number.isFinite(messageId)) {
          webSocket.send(
            JSON.stringify({ type: "error", message: "messageId required" })
          );
          return;
        }
        const projectId = this.projectId;
        const existing = await this.env.DB.prepare(
          "SELECT id, user_id FROM messages WHERE id = ? AND project_id = ? AND room_id = ? AND deleted_at IS NULL"
        )
          .bind(messageId, projectId, roomId)
          .first();
        if (!existing) {
          webSocket.send(
            JSON.stringify({ type: "error", message: "message not found" })
          );
          return;
        }
        if (existing.user_id !== userId) {
          webSocket.send(
            JSON.stringify({ type: "error", message: "forbidden" })
          );
          return;
        }
        const now = new Date().toISOString();
        await this.env.DB.prepare(
          "UPDATE messages SET deleted_at = ?, content = ? WHERE id = ? AND project_id = ? AND user_id = ?"
        )
          .bind(now, "[deleted]", messageId, projectId, userId)
          .run();
        this.broadcast({
          type: "delete",
          id: messageId,
          roomId,
          userId,
          deletedAt: now,
        });
        return;
      }

      if (msg.type === "typing") {
        const payload = {
          type: "typing",
          userId: msg.userId,
          isTyping: !!msg.isTyping,
        };
        this.broadcast(payload);
        return;
      }

      if (msg.type === "agentTyping") {
        const payload = {
          type: "agentTyping",
          agentId: msg.agentId,
          isTyping: !!msg.isTyping,
        };
        this.broadcast(payload);
        return;
      }
    } catch (err) {
      logError("do.onMessage_error", err, {
        roomId: this.state.id.toString(),
        messageType: msg?.type ?? "unknown",
      });
      webSocket.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format or internal error",
        })
      );
    }
  }

  onClose(webSocket) {
    this.clients.delete(webSocket);
    this.userIds.delete(webSocket);
    // Exclude recovered-presence entries (prefix "recovered:") — they are not
    // active WebSocket connections and should not appear in presence counts.
    const activeUserIds = Array.from(this.userIds.values()).filter(
      (uid) => !String(uid).startsWith("recovered:")
    );
    this.broadcast({
      type: "presence",
      online: this.clients.size,
      users: activeUserIds,
    });
  }

  async broadcast(message) {
    // Always broadcast presence with only the currently active WS connections
    // (recovered-presence entries are not real clients and are excluded from counts).
    if (message.type === "presence") {
      const activeUserIds = Array.from(this.userIds.values()).filter(
        (uid) => !String(uid).startsWith("recovered:")
      );
      message = { ...message, online: this.clients.size, users: activeUserIds };
    }
    const payload = JSON.stringify(message);
    const deadClients = [];
    for (const client of this.clients) {
      try {
        client.send(payload);
      } catch {
        deadClients.push(client);
      }
    }
    for (const client of deadClients) {
      this.clients.delete(client);
    }
    const sseData = `data: ${payload}\n\n`;
    const deadWriters = [];
    for (const writer of [...this.sseClients]) {
      try {
        await writer.write(new TextEncoder().encode(sseData));
      } catch {
        deadWriters.push(writer);
      }
    }
    // Remove dead writers after iteration; attempt to send SSE close sentinel first
    for (const writer of deadWriters) {
      this.sseClients.delete(writer);
      try {
        const sentinel = new TextEncoder().encode("data: {\"type\":\"close\",\"reason\":\"hibernation\"}\n\n");
        await writer.write(sentinel);
        await writer.close();
      } catch {
        // writer already dead — ignore
      }
    }
  }

  consumeWsRateLimit(key, limit, windowMs) {
    // NOTE: wsRateLimitStore resets on DO hibernation. Rate limit buckets are
    // in-memory only and lost on wake. Persisting to D1 per message is
    // prohibitively expensive. Accept this limitation as known behavior.
    if (!key || !Number.isFinite(limit) || limit <= 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const now = Date.now();
    const bucket = this.wsRateLimitStore.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      this.wsRateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (bucket.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
      };
    }
    bucket.count += 1;
    this.wsRateLimitStore.set(key, bucket);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  async checkModeration(roomId, userId) {
    const cacheKey = `${roomId}:${userId}`;
    const cached = this.moderationCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expires > now) {
      return cached.state;
    }

    const row = await this.env.DB.prepare(
      "SELECT action, expires_at FROM moderation_events WHERE room_id = ? AND user_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 1"
    )
      .bind(roomId, userId, new Date().toISOString())
      .first();

    const state = {
      muted: row?.action === "mute",
      banned: row?.action === "ban",
    };
    this.moderationCache.set(cacheKey, {
      state,
      expires: Date.now() + 10_000, // cache 10s
    });
    return state;
  }

  async fetch(request) {
    await this.ensureStorageHydrated();

    if (request.headers.get("Upgrade") === "websocket") {
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleWebSocket(server, request);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (new URL(request.url).pathname === "/sse" && request.method === "GET") {
      const auth = await verifyJwtAndGetContext(request, this.env).catch(() => null);
      if (!auth) {
        return new Response("Unauthorized", { status: 401 });
      }
      const roomId = this.roomId || this.state.id.toString();
      await this.persistRoomContext(auth.projectId, roomId);
      const isMember = await isRoomMember(this.env, auth.projectId, roomId, auth.userId);
      if (!isMember) {
        return new Response("Forbidden", { status: 403 });
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      this.sseClients.add(writer);

      const heartbeat = setInterval(() => {
        try {
          writer.write(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          this.sseClients.delete(writer);
        }
      }, 30_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        this.sseClients.delete(writer);
        try { writer.close(); } catch {}
      };

      const projectId = this.projectId;
      this.env.DB.prepare(
        "SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at, mentions, og_title, og_description, og_image, og_url, client_message_id FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50"
      ).bind(projectId, roomId).all().then(async (result) => {
        const rows = result.results || [];
        const mapped = await attachAttachmentsToMessages(this.env, projectId, roomId, rows);
        const historyPayload = JSON.stringify({ type: "history", messages: mapped.reverse() });
        await writer.write(encoder.encode(`data: ${historyPayload}\n\n`));
      }).catch(() => {});

      request.signal.addEventListener("abort", cleanup, { once: true });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (new URL(request.url).pathname === "/stream" && request.method === "POST") {
      const body = await request.json();
      const roomId = this.roomId || this.state.id.toString();
      const result = await this.processStreamOp({
        projectId: body.projectId,
        roomId,
        userId: body.userId,
        op: body.op,
        content: body.content,
        messageId: body.messageId,
        parentId: body.parentId ?? null,
      });
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (new URL(request.url).pathname === "/announce" && request.method === "POST") {
      const body = await request.json();
      const roomIdStr = this.state.id.toString();
      if (body.type === "agentTyping") {
        this.broadcast({
          type: "agentTyping",
          agentId: body.agentId || body.userId,
          isTyping: !!body.isTyping,
        });
      } else if (body.type === "edit") {
        this.broadcast({
          type: "edit",
          id: body.id,
          roomId: body.roomId || roomIdStr,
          userId: body.userId,
          content: body.content,
          editedAt: body.editedAt,
        });
      } else if (body.type === "delete") {
        this.broadcast({
          type: "delete",
          id: body.id,
          roomId: body.roomId || roomIdStr,
          userId: body.userId,
          deletedAt: body.deletedAt,
          ...(body.hard !== undefined ? { hard: !!body.hard } : {}),
        });
      } else if (body.type === "reaction") {
        this.broadcast({
          type: "reaction",
          roomId: body.roomId || roomIdStr,
          userId: body.userId,
          messageId: body.messageId,
          emoji: body.emoji,
          op: body.op,
        });
      } else if (
        body.type === "tool_call" ||
        body.type === "tool_result" ||
        body.type === "tool_error"
      ) {
        this.broadcast({
          type: body.type,
          roomId: body.roomId || roomIdStr,
          runId: body.runId,
          agentId: body.agentId,
          toolCallId: body.toolCallId,
          name: body.name,
          arguments: body.arguments,
          result: body.result,
          error: body.error,
        });
      } else if (body.type === "agentRun" && body.run) {
        this.broadcast({
          type: "agentRun",
          roomId: body.roomId || roomIdStr,
          run: body.run,
        });
      } else {
        const messageId = body.id || Date.now();
        const rid = typeof body.roomId === "string" ? body.roomId : roomIdStr;
        const payload = {
          type: "message",
          id: messageId,
          roomId: rid,
          userId: body.senderId || body.userId || "system",
          senderId: body.senderId || body.userId || "system",
          content: body.content,
          createdAt: body.createdAt || new Date().toISOString(),
          parentId: (() => {
            const p = body.parentId;
            if (p === undefined || p === null || p === "") return null;
            const n = Number(p);
            return Number.isFinite(n) ? n : null;
          })(),
          mentions: Array.isArray(body.mentions) ? body.mentions : [],
          preview: body.preview ?? null,
          attachments: Array.isArray(body.attachments) ? body.attachments : [],
          ...(body.clientMessageId ? { clientMessageId: body.clientMessageId } : {}),
        };
        this.broadcast(payload);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Unsupported DO request", { status: 400 });
  }
}