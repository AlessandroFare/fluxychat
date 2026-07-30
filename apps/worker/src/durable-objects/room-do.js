import { verifyJwtAndGetContext } from "../lib/jwt-request.js";
import {
  isValidClientWsPayload,
  isValidLocationTrackEnded,
  isValidLocationUpdate,
} from "../lib/ws-protocol.js";
import { logInfo, logError } from "../lib/worker-log.js";
import { isRoomMember, canAccessRoom } from "../lib/room-access.js";
import { guestMemberRoleForJoin } from "../lib/guest-auth.js";
import { attachAttachmentsToMessages } from "../lib/messages-attachments.js";
import { checkAndConsumeProjectQuota } from "../lib/project-plan-quota.js";
import { validateMessageContent } from "../lib/message-validation.js";
import { runInboundMessageMiddleware } from "../lib/message-middleware.js";
import {
  runFluxyRoomAuthz,
  runFluxyPublishPipeline,
  runFluxyDisconnectHooks,
} from "../lib/fluxy-config-runtime.js";
import { serializeMessage } from "../lib/message-serialization.js";
import {
  notifyDmRecipient,
  notifyMentionedUsers,
} from "../lib/in-app-notifications.js";
import {
  quotaResetInfo,
  extractMentions,
  extractFirstUrl,
  fetchOgPreview,
} from "../lib/message-enrichment.js";
import { deliverWebhooks } from "../lib/webhook-delivery.js";
import { normalizeClientMessageId } from "../lib/client-message-id.js";
import { safeSchedulePostMessageAutomations } from "../lib/post-message-automations-safe.js";
import { invokeMentionedAgents } from "../lib/agent-runtime.js";
import {
  buildPresenceMembers,
  listActivePresenceUserIds,
  normalizeClientEventName,
  parsePresenceInfoParam,
  CLIENT_EVENT_MAX_PER_MINUTE,
} from "../lib/room-presence.js";
import {
  ROOM_CACHE_STORAGE_KEY,
  isCacheableBroadcast,
  buildCacheEntry,
  parseStoredCacheEntry,
  parseCacheConnectParam,
} from "../lib/room-cache.js";
import {
  fanoutWatchlistForTarget,
  WATCHLIST_ROOM_EVENT_TYPES,
} from "../lib/user-watchlist.js";
import { runStorageMigrations } from "../lib/do-sql-migrations.js";
import { YjsSyncHandler } from "../lib/yjs-sync.js";
import { maybeSyncMatrixOutboundForMessage } from "../lib/matrix-outbound-hook.js";

/**
 * Ordered list of migrations applied to the Room DO's `ctx.storage`.
 *
 * P11-A1 scaffolding: a single no-op v1 registers the baseline. Future
 * shape changes (e.g. moving hot state into `ctx.storage.sql`, adding
 * new presence fields, changing the cache key encoding) append new
 * entries with monotonically increasing versions. The runner is
 * idempotent and re-entrant — see `lib/do-sql-migrations.js`.
 *
 * @type {Array<{ version: number, name: string, up: (ctx: { state: import("@cloudflare/workers-types").DurableObjectState }) => Promise<void> | void }>}
 */
export const EPHEMERAL_WS_RATE_LIMIT_KEY = "_ephemeral_ws_rate_limits";
export const EPHEMERAL_MODERATION_CACHE_KEY = "_ephemeral_moderation_cache";

export const ROOM_DO_MIGRATIONS = [
  {
    version: 1,
    name: "baseline_storage_shape",
    up: async () => {
      // No-op baseline: register the version counter on first hydration.
      // Future migrations can rely on `state.storage` already containing
      // the documented v1 shape.
    },
  },
  {
    version: 2,
    name: "ephemeral_state_storage_keys",
    up: async () => {
      // wsRateLimitStore + moderationCache persist under EPHEMERAL_* keys.
    },
  },
];

export const DEFAULT_WS_HISTORY_LIMIT = 50;
export const MAX_WS_HISTORY_LIMIT = 500;
export const LOCATION_STALE_TTL_MS = 30_000;
export const LOCATION_UPDATE_INTERVAL_MS = 1_000;

/**
 * @param {Request} request
 * @returns {{ replay: "default" | "off" | "connect", limit: number, cache: boolean }}
 */
export function parseWsConnectOptions(request) {
  let replay = "default";
  let limit = DEFAULT_WS_HISTORY_LIMIT;
  let cache = false;
  try {
    const url = new URL(request.url);
    cache = parseCacheConnectParam(url.searchParams.get("cache"));
    const replayParam = url.searchParams.get("replay")?.toLowerCase();
    if (replayParam === "off" || replayParam === "false" || replayParam === "0") {
      replay = "off";
    } else if (
      replayParam === "connect" ||
      replayParam === "true" ||
      replayParam === "1"
    ) {
      replay = "connect";
    }
    const limitRaw =
      url.searchParams.get("replayLimit") ?? url.searchParams.get("historyLimit");
    if (limitRaw) {
      const n = Number(limitRaw);
      if (Number.isFinite(n) && n > 0) {
        limit = Math.min(Math.floor(n), MAX_WS_HISTORY_LIMIT);
      }
    }
  } catch {
    /* keep defaults */
  }
  return { replay, limit, cache };
}

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
    /** @type {Map<WebSocket, MessageEvent[]>} */
    this.wsInboundQueues = new Map();
    /** Active WS connections per user (Pusher-style presence). */
    this.userConnectionCounts = new Map();
    /** Optional profile payload from `presenceInfo` WS query param. */
    this.userInfoByUserId = new Map();
    /** Per-connection id (exclude-sender / debugging). */
    this.socketIds = new Map();
    /** @type {Map<WebSocket, Record<string, boolean | undefined>>} */
    this.wsCapabilities = new Map();
    /** @type {{ event: Record<string, unknown>; cachedAt: string } | null} */
    this.lastCacheEntry = null;
    /** Ephemeral last-known foreground location per track. */
    this.locationTracks = new Map();
    /** Last accepted update time per user/track, enforcing the 1 Hz ceiling. */
    this.locationUpdateTimes = new Map();
    /** @type {YjsSyncHandler} */
    this.yjsSync = new YjsSyncHandler();

    if (typeof this.state.blockConcurrencyWhile === "function" && this.state.storage) {
      this._storageHydrated = this.state.blockConcurrencyWhile(async () => {
        // Run pending migrations BEFORE reading state so that any shape
        // changes from `up()` are visible to the hydration below.
        await runStorageMigrations(this.state, ROOM_DO_MIGRATIONS);
        await this.loadEphemeralFromStorage();
        const storedProjectId = await this.state.storage.get("projectId");
        const storedRoomId = await this.state.storage.get("roomId");
        if (typeof storedProjectId === "string" && storedProjectId) {
          this.projectId = storedProjectId;
        }
        if (typeof storedRoomId === "string" && storedRoomId) {
          this.roomId = storedRoomId;
        }
        const storedCache = await this.state.storage.get(ROOM_CACHE_STORAGE_KEY);
        this.lastCacheEntry = parseStoredCacheEntry(storedCache);
      });
    } else {
      this._storageHydrated = Promise.resolve();
    }
  }

  async ensureStorageHydrated() {
    await this._storageHydrated;
  }

  async loadEphemeralFromStorage() {
    if (!this.state.storage) return;
    const wsRaw = await this.state.storage.get(EPHEMERAL_WS_RATE_LIMIT_KEY);
    if (wsRaw && typeof wsRaw === "object" && !Array.isArray(wsRaw)) {
      this.wsRateLimitStore = new Map(Object.entries(wsRaw));
    }
    const modRaw = await this.state.storage.get(EPHEMERAL_MODERATION_CACHE_KEY);
    if (modRaw && typeof modRaw === "object" && !Array.isArray(modRaw)) {
      this.moderationCache = new Map(Object.entries(modRaw));
    }
  }

  async persistEphemeralToStorage() {
    if (!this.state.storage) return;
    const now = Date.now();
    const wsObj = Object.fromEntries(
      [...this.wsRateLimitStore.entries()].filter(([, bucket]) => bucket && bucket.expiresAt > now),
    );
    const modObj = Object.fromEntries(
      [...this.moderationCache.entries()].filter(([, entry]) => entry && entry.expires > now),
    );
    if (Object.keys(wsObj).length) {
      await this.state.storage.put(EPHEMERAL_WS_RATE_LIMIT_KEY, wsObj);
    } else {
      await this.state.storage.delete(EPHEMERAL_WS_RATE_LIMIT_KEY);
    }
    if (Object.keys(modObj).length) {
      await this.state.storage.put(EPHEMERAL_MODERATION_CACHE_KEY, modObj);
    } else {
      await this.state.storage.delete(EPHEMERAL_MODERATION_CACHE_KEY);
    }
  }

  getActiveUserIds() {
    return listActivePresenceUserIds(this.userIds, this.userConnectionCounts);
  }

  getPresenceSnapshot() {
    const userIds = this.getActiveUserIds();
    return {
      online: this.clients.size,
      subscriptionCount: this.clients.size,
      users: userIds,
      members: buildPresenceMembers(userIds, this.userInfoByUserId),
    };
  }

  broadcastSubscriptionCount() {
    const roomIdStr = this.roomId || this.state.id.toString();
    const count = this.clients.size;
    this.broadcast({
      type: "subscription_count",
      roomId: roomIdStr,
      subscriptionCount: count,
    });
    void this.notifyPresenceWebhook("subscription_count", {
      roomId: roomIdStr,
      subscriptionCount: count,
      at: new Date().toISOString(),
    });
  }

  async notifyPresenceWebhook(eventType, payload) {
    const projectId = this.projectId;
    if (!projectId) return;
    void deliverWebhooks(this.env, projectId, eventType, payload).catch((err) =>
      logError("webhook.presence_failed", err, { eventType, roomId: payload?.roomId }),
    );
  }

  async notifyRoomOccupancyWebhook(eventType) {
    const projectId = this.projectId;
    const roomId = this.roomId || this.state.id.toString();
    if (!projectId || !roomId) return;
    void deliverWebhooks(this.env, projectId, eventType, {
      roomId,
      at: new Date().toISOString(),
    }).catch((err) => logError("webhook.room_lifecycle_failed", err, { roomId, eventType }));
  }

  async notifyCacheMissWebhook() {
    const projectId = this.projectId;
    const roomId = this.roomId || this.state.id.toString();
    if (!projectId || !roomId) return;
    void deliverWebhooks(this.env, projectId, "cache_miss", {
      roomId,
      at: new Date().toISOString(),
    }).catch((err) => logError("webhook.cache_miss_failed", err, { roomId }));
  }

  async persistLastCacheEvent(message) {
    if (!isCacheableBroadcast(message)) return;
    const entry = buildCacheEntry(message);
    this.lastCacheEntry = entry;
    if (this.state.storage) {
      await this.state.storage.put(ROOM_CACHE_STORAGE_KEY, entry);
    }
  }

  /**
   * @param {WebSocket} webSocket
   */
  async sendCacheOnConnect(webSocket) {
    let entry = this.lastCacheEntry;
    if (!entry && this.state.storage) {
      const stored = await this.state.storage.get(ROOM_CACHE_STORAGE_KEY);
      entry = parseStoredCacheEntry(stored);
      if (entry) this.lastCacheEntry = entry;
    }
    const roomIdStr = this.roomId || this.state.id.toString();
    if (entry) {
      webSocket.send(
        JSON.stringify({
          type: "cache_snapshot",
          roomId: roomIdStr,
          event: entry.event,
          cachedAt: entry.cachedAt,
        }),
      );
      return;
    }
    void this.notifyCacheMissWebhook();
  }

  pruneLocationTracks(now = Date.now()) {
    for (const [trackId, track] of this.locationTracks) {
      if (Date.parse(track.staleAt) <= now) {
        this.locationTracks.delete(trackId);
        this.locationUpdateTimes.delete(`${track.userId}:${trackId}`);
      }
    }
  }

  sendLocationSnapshot(webSocket) {
    this.pruneLocationTracks();
    webSocket.send(
      JSON.stringify({
        type: "location_snapshot",
        roomId: this.roomId || this.state.id.toString(),
        tracks: [...this.locationTracks.values()],
        generatedAt: new Date().toISOString(),
      }),
    );
  }

  incrementUserConnection(userId) {
    const next = (this.userConnectionCounts.get(userId) || 0) + 1;
    this.userConnectionCounts.set(userId, next);
    return next;
  }

  decrementUserConnection(userId) {
    const current = this.userConnectionCounts.get(userId) || 0;
    if (current <= 1) {
      this.userConnectionCounts.delete(userId);
      return 0;
    }
    const next = current - 1;
    this.userConnectionCounts.set(userId, next);
    return next;
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
    try {
      await this.persistRoomContext(auth.projectId, roomId);
    } catch (err) {
      logError("do.ws_persist_room_context_failed", err, { roomId });
    }
    let isMember = false;
    try {
      isMember = await canAccessRoom(this.env, auth, roomId);
    } catch (err) {
      logError("do.ws_can_access_room_failed", err, { roomId });
    }
    if (!isMember) {
      webSocket.close(1008, "Forbidden");
      return;
    }
    const authz = await runFluxyRoomAuthz(roomId, auth);
    if (authz.action === "block") {
      webSocket.close(1008, String(authz.reason).slice(0, 120));
      return;
    }
    this.wsCapabilities.set(webSocket, authz.capabilities ?? {});
    try {
      await ensurePublicRoomMembership(
        this.env,
        auth.projectId,
        roomId,
        auth.userId,
        guestMemberRoleForJoin(auth),
      );
    } catch (err) {
      logError("do.ws_ensure_public_room_membership_failed", err, { roomId });
    }

    this.clients.add(webSocket);
    logInfo("do.client_count", {
      roomId: this.state.id.toString(),
      wsClients: this.clients.size,
      sseClients: this.sseClients.size,
    });
    const userId = auth.userId;
    this.userIds.set(webSocket, userId);
    const socketId = crypto.randomUUID();
    this.socketIds.set(webSocket, socketId);

    try {
      const connectUrl = new URL(request.url);
      const presenceInfo = parsePresenceInfoParam(
        connectUrl.searchParams.get("presenceInfo"),
      );
      if (Object.keys(presenceInfo).length) {
        this.userInfoByUserId.set(userId, presenceInfo);
      }
    } catch {
      /* ignore */
    }

    const wasVacant = this.clients.size === 1;
    const userConnCount = this.incrementUserConnection(userId);
    const roomIdStr = roomId;

    // Presence recovery: on DO wake after hibernation, reconstruct online user list
    // from D1 read_receipts so the presence broadcast reflects recent activity rather
    // than showing empty state. WebSocket connections themselves cannot be restored.
    let recentUsersRows = { results: [] };
    try {
      recentUsersRows = await this.env.DB.prepare(
        "SELECT DISTINCT user_id FROM read_receipts WHERE room_id = ? AND project_id = ? ORDER BY last_read_at DESC LIMIT 100"
      )
        .bind(roomId, this.projectId)
        .all();
    } catch {
      try {
        recentUsersRows = await this.env.DB.prepare(
          "SELECT DISTINCT user_id FROM read_receipts WHERE room_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 100"
        )
          .bind(roomId, this.projectId)
          .all();
      } catch {
        recentUsersRows = { results: [] };
      }
    }
    const recoveredUserIds = (recentUsersRows.results || []).map((r) => r.user_id).filter((uid) => uid !== userId);
    for (const uid of recoveredUserIds) {
      this.userIds.set(`recovered:${uid}`, uid);
    }

    const inboundQueue = [];
    this.wsInboundQueues.set(webSocket, inboundQueue);
    webSocket.addEventListener("message", (event) => {
      if (this.wsInboundQueues.has(webSocket)) {
        inboundQueue.push(event);
        return;
      }
      void this.onMessage(webSocket, event);
    });
    webSocket.addEventListener("close", () =>
      this.onClose(webSocket)
    );
    webSocket.addEventListener("error", () =>
      this.onClose(webSocket)
    );

    const projectId = this.projectId;
    const connectOpts = parseWsConnectOptions(request);
    if (connectOpts.cache) {
      try {
        await this.sendCacheOnConnect(webSocket);
      } catch (err) {
        logError("do.cache_on_connect_failed", err, { roomId, projectId });
      }
    }
    if (connectOpts.replay !== "off") {
      try {
        await this.sendConnectSnapshot(webSocket, {
          projectId,
          roomId,
          limit: connectOpts.limit,
          envelopeType: connectOpts.replay === "connect" ? "replay" : "history",
          viewerUserId: userId,
        });
      } catch (err) {
        logError("do.connect_snapshot_send_failed", err, { roomId, projectId });
      }
    }

    try {
      await this.sendActiveStreamState(webSocket, {
        projectId,
        roomId,
        userId,
      });
    } catch (err) {
      logError("do.active_stream_state_failed", err, { roomId, projectId });
    }

    try {
      this.sendLocationSnapshot(webSocket);
    } catch (err) {
      logError("do.location_snapshot_failed", err, { roomId, projectId });
    }

    this.wsInboundQueues.delete(webSocket);
    for (const queued of inboundQueue) {
      void this.onMessage(webSocket, queued);
    }

    const presence = this.getPresenceSnapshot();
    try {
      webSocket.send(
        JSON.stringify({
          type: "subscription_succeeded",
          roomId: roomIdStr,
          socketId,
          subscriptionCount: presence.subscriptionCount,
          members: presence.members,
        }),
      );
    } catch (err) {
      logError("do.ws_send_subscription_succeeded_failed", err, { roomId });
    }

    if (userConnCount === 1) {
      const joinPayload = {
        type: "member_joined",
        roomId: roomIdStr,
        userId,
        userInfo: this.userInfoByUserId.get(userId) ?? {},
        socketId,
      };
      this.broadcast(joinPayload, { excludeWebSocket: webSocket });
      void this.notifyPresenceWebhook("member_joined", {
        roomId: roomIdStr,
        userId,
        userInfo: joinPayload.userInfo,
        socketId,
        subscriptionCount: presence.subscriptionCount,
        at: new Date().toISOString(),
      });
    }

    this.broadcast({
      type: "presence",
      online: presence.online,
      users: presence.users,
      members: presence.members,
    });
    try {
      this.broadcastSubscriptionCount();
    } catch (err) {
      logError("do.ws_broadcast_sub_count_failed", err, { roomId });
    }

    if (wasVacant) {
      void this.notifyRoomOccupancyWebhook("room.occupied");
    }
  }

  /**
   * @param {WebSocket} webSocket
   * @param {{ projectId: string, roomId: string, limit: number, envelopeType: "history" | "replay" }} opts
   */
  async loadConnectSnapshotRows(projectId, roomId, limit, viewerUserId, extendedSchema) {
    const { messageVisibilitySql } = await import("../lib/message-visibility.js");
    const vis = messageVisibilitySql(viewerUserId || "");
    const voiceCols = extendedSchema
      ? ", kind, audio_url, duration_ms, transcription, transcription_status"
      : "";
    const visibilityCols = extendedSchema ? ", visibility, visible_to_json" : "";
    const result = await this.env.DB.prepare(
      `SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at,
              mentions, og_title, og_description, og_image, og_url, client_message_id
              ${visibilityCols}${voiceCols}
       FROM messages
       WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL${extendedSchema ? vis.sql : ""}
       ORDER BY created_at DESC LIMIT ?`,
    )
      .bind(
        projectId,
        roomId,
        ...(extendedSchema ? vis.binds : []),
        limit,
      )
      .all();
    return result.results || [];
  }

  async sendConnectSnapshot(webSocket, {
    projectId,
    roomId,
    limit,
    envelopeType,
    viewerUserId,
  }) {
    let rows = [];
    try {
      rows = await this.loadConnectSnapshotRows(
        projectId,
        roomId,
        limit,
        viewerUserId,
        true,
      );
    } catch (err) {
      logError("do.connect_snapshot_extended_failed", err, { roomId, projectId });
      try {
        rows = await this.loadConnectSnapshotRows(
          projectId,
          roomId,
          limit,
          viewerUserId,
          false,
        );
      } catch (fallbackErr) {
        logError("do.connect_snapshot_failed", fallbackErr, { roomId, projectId });
        rows = [];
      }
    }

    let mapped = [];
    try {
      mapped = await attachAttachmentsToMessages(this.env, projectId, roomId, rows);
    } catch (err) {
      logError("do.connect_snapshot_attach_failed", err, { roomId, projectId });
      mapped = [];
    }

    // Fetch reactions for the loaded messages
    let reactionsMap = {};
    try {
      const messageIds = mapped.map((m) => m.id).filter(Boolean);
      if (messageIds.length > 0) {
        const placeholders = messageIds.map(() => "?").join(",");
        const reactionRows = await this.env.DB.prepare(
          `SELECT message_id, emoji, COUNT(*) as count FROM message_reactions WHERE project_id = ? AND message_id IN (${placeholders}) GROUP BY message_id, emoji`
        )
          .bind(projectId, ...messageIds)
          .all();
        for (const r of reactionRows.results || []) {
          if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = {};
          reactionsMap[r.message_id][r.emoji] = r.count;
        }
      }
    } catch (err) {
      logError("do.connect_snapshot_reactions_failed", err, { roomId, projectId });
    }

    webSocket.send(
      JSON.stringify({
        type: envelopeType,
        messages: mapped.reverse(),
        reactions: reactionsMap,
      }),
    );
  }

  /**
   * @param {WebSocket} webSocket
   * @param {{ projectId: string, roomId: string, userId: string }} opts
   */
  async sendActiveStreamState(webSocket, { projectId, roomId, userId }) {
    const stream = this.activeStreams.get(userId);
    if (!stream?.messageId) return;

    const row = await this.env.DB.prepare(
      "SELECT id, user_id, content, created_at, parent_id FROM messages WHERE id = ? AND project_id = ? AND room_id = ? AND deleted_at IS NULL"
    )
      .bind(stream.messageId, projectId, roomId)
      .first();
    if (!row) return;

    webSocket.send(
      JSON.stringify({
        type: "streamState",
        messageId: row.id,
        roomId,
        userId: row.user_id,
        content: row.content ?? "",
        createdAt: row.created_at,
        parentId: row.parent_id ? Number(row.parent_id) || null : null,
        streaming: true,
      })
    );
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
        void safeSchedulePostMessageAutomations(this.env, {
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
    if (event.data instanceof ArrayBuffer) {
      const roomId = this.roomId || this.state.id.toString();
      await this.yjsSync.handleBinary(
        new Uint8Array(event.data),
        webSocket,
        roomId,
        this.state.storage,
        (data, excludeWs) => this.broadcastBinary(data, excludeWs),
        {
          onActivity: ({ roomId: rid, name, byteLength }) => {
            const userId = this.userIds.get(webSocket) || "system";
            this.broadcast({
              type: "server_event",
              roomId: rid,
              name,
              data: { byteLength, channel: "yjs" },
              userId,
            });
          },
        },
      );
      return;
    }

    let msg;
    try {
      msg = JSON.parse(event.data);

      if (!isValidClientWsPayload(msg)) {
        webSocket.send(
          JSON.stringify({ type: "error", message: "unknown_event_type" }),
        );
        return;
      }

      if (msg.type === "ping") {
        webSocket.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        return;
      }

      if (msg.type === "message") {
        const roomId = this.roomId || this.state.id.toString();
        const { id, userId, content, parentId, attachments } = msg;
        const clientMessageId = normalizeClientMessageId(msg.clientMessageId);
        const { resolveMessageExpiry } = await import("../lib/message-ttl.js");
        const expiryResult = resolveMessageExpiry(msg, this.env);
        if (!expiryResult.ok) {
          webSocket.send(
            JSON.stringify({ type: "error", message: expiryResult.error }),
          );
          return;
        }
        const messageExpiresAt = expiryResult.expiresAt;
        const { resolveMessageVisibility, whisperRecipientSet } = await import(
          "../lib/message-visibility.js"
        );
        const visibilityResult = resolveMessageVisibility(msg);
        if (!visibilityResult.ok) {
          webSocket.send(
            JSON.stringify({ type: "error", message: visibilityResult.error }),
          );
          return;
        }
        const { visibility, visibleTo } = visibilityResult;
        const visibleToJson =
          visibility === "whisper" ? JSON.stringify(visibleTo) : null;

        const middlewareResult = await runInboundMessageMiddleware(this.env, {
          content,
        });
        if (!middlewareResult.ok) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: `${middlewareResult.code}: ${middlewareResult.error}`,
            })
          );
          return;
        }
        let validatedContent = middlewareResult.content;

        const fluxyPipeline = await runFluxyPublishPipeline(
          roomId,
          { userId: this.userIds.get(webSocket) ?? userId },
          validatedContent,
          {
            capabilities: this.wsCapabilities.get(webSocket) ?? {},
            replyTo: parentId ?? null,
            attachments,
          },
        );
        if (!fluxyPipeline.ok) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: `blocked: ${fluxyPipeline.reason}`,
            }),
          );
          return;
        }
        validatedContent = fluxyPipeline.content;

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
        let isDuplicateResend = false;

        if (!messageId && clientMessageId) {
          const existing = await this.env.DB.prepare(
            `SELECT id FROM messages
             WHERE project_id = ? AND room_id = ? AND client_message_id = ? AND deleted_at IS NULL
             LIMIT 1`,
          )
            .bind(projectId, roomId, clientMessageId)
            .first();
          if (existing?.id) {
            messageId = existing.id;
            isDuplicateResend = true;
          }
        }

        if (!messageId) {
          const result = await this.env.DB.prepare(
            "INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url, expires_at, visibility, visible_to_json, client_message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
              preview?.url || null,
              messageExpiresAt,
              visibility === "room" ? null : visibility,
              visibleToJson,
              clientMessageId,
            )
            .run();
          messageId = result.meta.last_row_id;
          if (messageExpiresAt) {
            void this.scheduleMessageExpiryAlarm();
          }
        }

        if (!isDuplicateResend && Array.isArray(attachments) && attachments.length) {
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

        if (!isDuplicateResend && mentions.length) {
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

          void notifyMentionedUsers(this.env, {
            projectId,
            roomId,
            fromUserId: userId,
            toUserIds: mentions,
            messageId,
            preview: validatedContent,
          }).catch((err) =>
            logError("notifications.mention_failed", err, { projectId, roomId }),
          );
        }

        if (!isDuplicateResend) {
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
            void notifyDmRecipient(this.env, {
              projectId,
              roomId,
              fromUserId: userId,
              messageId,
              preview: validatedContent,
            }).catch((err) =>
              logError("notifications.dm_failed", err, { projectId, roomId }),
            );
          }

          void safeSchedulePostMessageAutomations(this.env, {
            projectId,
            roomId,
            authorUserId: userId,
            messageId,
            content: validatedContent,
            traceId: undefined,
            mentionedUserIds: mentions,
            roomType: roomRow?.type ?? null,
            attachments: Array.isArray(attachments) ? attachments : [],
          });
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
          ...(clientMessageId ? { clientMessageId } : {}),
          ...(messageExpiresAt ? { expiresAt: messageExpiresAt } : {}),
          ...(visibility === "whisper"
            ? { visibility, visibleTo }
            : {}),
          ...(middlewareResult.meta ? { middleware: middlewareResult.meta } : {}),
        };

        const whisperRecipients = whisperRecipientSet(visibility, visibleTo, userId);
        this.broadcast(
          payload,
          whisperRecipients ? { recipientUserIds: whisperRecipients } : {},
        );

        if (!isDuplicateResend && validatedContent) {
          void maybeSyncMatrixOutboundForMessage(this.env, {
            projectId,
            roomId,
            messageId,
            content: validatedContent,
          }).catch((err) =>
            logError("matrix.outbound_hook_failed", err, { projectId, roomId }),
          );
        }

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
            "INSERT INTO message_reactions (project_id, message_id, room_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?)"
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

      if (msg.type === "location_update") {
        const roomId = this.roomId || this.state.id.toString();
        const userId = this.userIds.get(webSocket);
        if (!userId) {
          webSocket.send(JSON.stringify({ type: "error", message: "location_requires_auth" }));
          return;
        }
        if (!isValidLocationUpdate(msg)) {
          webSocket.send(JSON.stringify({ type: "error", message: "invalid_location_update" }));
          return;
        }
        const now = Date.now();
        const updateKey = `${userId}:${msg.trackId}`;
        const lastUpdate = this.locationUpdateTimes.get(updateKey) || 0;
        if (now - lastUpdate < LOCATION_UPDATE_INTERVAL_MS) {
          webSocket.send(JSON.stringify({ type: "error", message: "location_rate_limited" }));
          return;
        }
        const existing = this.locationTracks.get(msg.trackId);
        if (existing && existing.userId !== userId) {
          webSocket.send(JSON.stringify({ type: "error", message: "location_track_forbidden" }));
          return;
        }
        const updatedAt = new Date(now).toISOString();
        const track = {
          trackId: msg.trackId,
          roomId,
          userId,
          latitude: msg.latitude,
          longitude: msg.longitude,
          ...(msg.accuracy == null ? {} : { accuracy: msg.accuracy }),
          ...(msg.altitude === undefined ? {} : { altitude: msg.altitude }),
          ...(msg.heading === undefined ? {} : { heading: msg.heading }),
          ...(msg.speed === undefined ? {} : { speed: msg.speed }),
          updatedAt,
          staleAt: new Date(now + LOCATION_STALE_TTL_MS).toISOString(),
        };
        this.locationTracks.set(msg.trackId, track);
        this.locationUpdateTimes.set(updateKey, now);
        this.broadcast({ type: "location_update", ...track });
        return;
      }

      if (msg.type === "location_track_ended") {
        const roomId = this.roomId || this.state.id.toString();
        const userId = this.userIds.get(webSocket);
        if (!userId) {
          webSocket.send(JSON.stringify({ type: "error", message: "location_requires_auth" }));
          return;
        }
        if (!isValidLocationTrackEnded(msg)) {
          webSocket.send(JSON.stringify({ type: "error", message: "invalid_location_track_end" }));
          return;
        }
        const existing = this.locationTracks.get(msg.trackId);
        if (existing && existing.userId !== userId) {
          webSocket.send(JSON.stringify({ type: "error", message: "location_track_forbidden" }));
          return;
        }
        this.locationTracks.delete(msg.trackId);
        this.locationUpdateTimes.delete(`${userId}:${msg.trackId}`);
        this.broadcast({
          type: "location_track_ended",
          roomId,
          trackId: msg.trackId,
          userId,
          endedAt: new Date().toISOString(),
        });
        return;
      }

      if (msg.type === "client_event") {
        const roomId = this.roomId || this.state.id.toString();
        const userId = this.userIds.get(webSocket);
        if (!userId) {
          webSocket.send(
            JSON.stringify({ type: "error", message: "client_event_requires_auth" }),
          );
          return;
        }
        const normalized = normalizeClientEventName(msg.eventName);
        if (!normalized.ok) {
          webSocket.send(JSON.stringify({ type: "error", message: normalized.error }));
          return;
        }
        const clientEventRate = this.consumeWsRateLimit(
          `client-ev:${this.projectId}:${roomId}:${userId}`,
          CLIENT_EVENT_MAX_PER_MINUTE,
          60_000,
        );
        if (!clientEventRate.allowed) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: `rate_limit_exceeded: retry in ${clientEventRate.retryAfterSeconds}s`,
            }),
          );
          return;
        }
        this.broadcast(
          {
            type: "client_event",
            roomId,
            userId,
            eventName: normalized.eventName,
            data: msg.data ?? null,
          },
          { excludeWebSocket: webSocket },
        );
        void deliverWebhooks(this.env, this.projectId, "client_event", {
          roomId,
          userId,
          eventName: normalized.eventName,
          data: msg.data ?? null,
        }).catch((err) => logError("webhook.client_event_failed", err, { roomId }));
        return;
      }

      if (msg.type === "typing") {
        const { normalizePresenceIntent } = await import("../lib/presence-intent.js");
        const isTyping = !!msg.isTyping;
        const payload = {
          type: "typing",
          userId: msg.userId,
          isTyping,
          intent: normalizePresenceIntent(msg.intent, isTyping),
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
    const userId = this.userIds.get(webSocket);
    const roomId = this.roomId || this.state.id.toString();
    this.yjsSync.removeClient(webSocket, roomId);
    this.clients.delete(webSocket);
    this.userIds.delete(webSocket);
    this.socketIds.delete(webSocket);
    this.wsInboundQueues.delete(webSocket);
    this.wsCapabilities.delete(webSocket);

    const roomIdStr = this.roomId || this.state.id.toString();
    let memberLeft = false;
    if (userId && !String(userId).startsWith("recovered:")) {
      void runFluxyDisconnectHooks(roomIdStr, userId, "close");
      const remaining = this.decrementUserConnection(userId);
      if (remaining === 0) {
        memberLeft = true;
        const leftPayload = {
          type: "member_left",
          roomId: roomIdStr,
          userId,
        };
        this.broadcast(leftPayload);
        void this.notifyPresenceWebhook("member_left", {
          roomId: roomIdStr,
          userId,
          subscriptionCount: this.clients.size,
          at: new Date().toISOString(),
        });
      }
    }

    const presence = this.getPresenceSnapshot();
    this.broadcast({
      type: "presence",
      online: presence.online,
      users: presence.users,
      members: presence.members,
    });
    this.broadcastSubscriptionCount();

    if (this.clients.size === 0) {
      void this.notifyRoomOccupancyWebhook("room.vacated");
    }
  }

  broadcastBinary(data, excludeWebSocket) {
    const dead = [];
    for (const client of this.clients) {
      if (excludeWebSocket && client === excludeWebSocket) continue;
      try { client.send(data instanceof ArrayBuffer ? data : data.buffer); } catch { dead.push(client); }
    }
    for (const client of dead) this.clients.delete(client);
  }

  async broadcast(message, options = {}) {
    // Always broadcast presence with only the currently active WS connections
    // (recovered-presence entries are not real clients and are excluded from counts).
    if (message.type === "presence") {
      const activeUserIds = Array.from(this.userIds.values()).filter(
        (uid) => !String(uid).startsWith("recovered:")
      );
      message = { ...message, online: this.clients.size, users: activeUserIds };
    }
    if (isCacheableBroadcast(message)) {
      void this.persistLastCacheEvent(message);
    }

    // P22-E3: Add _type discriminator for cross-system identification
    const typedMessage = message.type ? message : serializeMessage(message);
    const payload = JSON.stringify(typedMessage);
    const recipientUserIds = options.recipientUserIds;
    const excludeWebSocket = options.excludeWebSocket;
    const excludeSocketId = options.excludeSocketId;
    const deadClients = [];
    for (const client of this.clients) {
      if (excludeWebSocket && client === excludeWebSocket) continue;
      if (excludeSocketId) {
        const sid = this.socketIds.get(client);
        if (sid === excludeSocketId) continue;
      }
      if (recipientUserIds) {
        const uid = this.userIds.get(client);
        if (!uid || !recipientUserIds.has(uid)) continue;
      }
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
      if (recipientUserIds) continue;
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

    const projectId = this.projectId;
    const roomIdStr = this.roomId || this.state.id.toString();
    if (projectId && roomIdStr && WATCHLIST_ROOM_EVENT_TYPES.has(message.type)) {
      void fanoutWatchlistForTarget(this.env, {
        projectId,
        targetType: "room",
        targetId: roomIdStr,
        event: message,
        excludeUserId:
          typeof message.userId === "string" ? message.userId : undefined,
      });
    }
    if (projectId && message.type === "member_joined" && message.userId) {
      void fanoutWatchlistForTarget(this.env, {
        projectId,
        targetType: "user",
        targetId: message.userId,
        event: message,
        excludeUserId: message.userId,
      });
    }
    if (projectId && message.type === "member_left" && message.userId) {
      void fanoutWatchlistForTarget(this.env, {
        projectId,
        targetType: "user",
        targetId: message.userId,
        event: message,
        excludeUserId: message.userId,
      });
    }
  }

  /**
   * @param {string} userId
   * @param {number} [code]
   * @param {string} [reason]
   * @returns {number}
   */
  terminateUserConnections(userId, code = 4001, reason = "terminated") {
    if (!userId) return 0;
    let closed = 0;
    for (const client of [...this.clients]) {
      const uid = this.userIds.get(client);
      if (!uid || uid !== userId || String(uid).startsWith("recovered:")) continue;
      try {
        client.close(code, reason);
        closed += 1;
      } catch {
        /* ignore */
      }
      this.clients.delete(client);
      this.userIds.delete(client);
      this.socketIds.delete(client);
      this.wsInboundQueues.delete(client);
    }
    return closed;
  }

  /**
   * @param {string} socketId
   * @param {number} [code]
   * @param {string} [reason]
   * @returns {number}
   */
  terminateSocketConnection(socketId, code = 4001, reason = "terminated") {
    if (!socketId) return 0;
    let closed = 0;
    for (const client of [...this.clients]) {
      const sid = this.socketIds.get(client);
      if (sid !== socketId) continue;
      try {
        client.close(code, reason);
        closed += 1;
      } catch {
        /* ignore */
      }
      this.clients.delete(client);
      this.userIds.delete(client);
      this.socketIds.delete(client);
      this.wsInboundQueues.delete(client);
    }
    return closed;
  }

  consumeWsRateLimit(key, limit, windowMs) {
    if (!key || !Number.isFinite(limit) || limit <= 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const now = Date.now();
    const bucket = this.wsRateLimitStore.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      this.wsRateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
      if (1 > limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((now + windowMs - now) / 1000)),
        };
      }
      void this.scheduleEphemeralCleanup();
      void this.persistEphemeralToStorage();
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (bucket.count + 1 > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
      };
    }
    bucket.count += 1;
    this.wsRateLimitStore.set(key, bucket);
    void this.scheduleEphemeralCleanup();
    void this.persistEphemeralToStorage();
    return { allowed: true, retryAfterSeconds: 0 };
  }

  pruneEphemeralState() {
    const now = Date.now();
    this.pruneLocationTracks(now);
    for (const [key, bucket] of this.wsRateLimitStore) {
      if (!bucket || bucket.expiresAt <= now) {
        this.wsRateLimitStore.delete(key);
      }
    }
    for (const [key, entry] of this.moderationCache) {
      if (!entry || entry.expires <= now) {
        this.moderationCache.delete(key);
      }
    }
    void this.persistEphemeralToStorage();
  }

  async scheduleEphemeralCleanup(delayMs = 60_000) {
    if (typeof this.state.storage?.setAlarm !== "function") return;
    if (this.wsRateLimitStore.size === 0 && this.moderationCache.size === 0) {
      if (typeof this.state.storage.deleteAlarm === "function") {
        await this.state.storage.deleteAlarm();
      }
      return;
    }
    const when = Date.now() + delayMs;
    const current = await this.state.storage.getAlarm();
    if (!current || current > when) {
      await this.state.storage.setAlarm(when);
    }
  }

  async scheduleMessageExpiryAlarm() {
    const projectId = this.projectId;
    const roomId = this.roomId || this.state.id.toString();
    if (!projectId || !roomId) return;
    const { scheduleRoomMessageExpiryAlarm } = await import(
      "../lib/expire-room-messages.js"
    );
    await scheduleRoomMessageExpiryAlarm(this.state.storage, this.env.DB, {
      projectId,
      roomId,
    });
  }

  async expireDueMessagesInRoom() {
    const projectId = this.projectId;
    const roomId = this.roomId || this.state.id.toString();
    if (!projectId || !roomId) return;
    const { findAndExpireDueMessages } = await import("../lib/expire-room-messages.js");
    const expired = await findAndExpireDueMessages(this.env.DB, {
      projectId,
      roomId,
    });
    for (const row of expired) {
      this.broadcast({
        type: "message_expired",
        id: row.id,
        roomId,
        userId: row.userId,
        expiredAt: row.expiredAt,
      });
      this.broadcast({
        type: "delete",
        id: row.id,
        roomId,
        userId: row.userId,
        deletedAt: row.expiredAt,
        hard: false,
      });
    }
    if (expired.length) {
      await this.scheduleMessageExpiryAlarm();
    }
  }

  async alarm() {
    await this.expireDueMessagesInRoom();
    const projectId = this.projectId;
    const roomId = this.roomId || this.state.id.toString();
    if (projectId && roomId) {
      const { processDueScheduledMessages } = await import(
        "../lib/scheduled-messages.js"
      );
      await processDueScheduledMessages(this.env, {
        projectId,
        roomId,
        broadcast: (payload) => this.broadcast(payload),
      });
    }
    this.pruneEphemeralState();
    if (this.wsRateLimitStore.size > 0 || this.moderationCache.size > 0) {
      await this.scheduleEphemeralCleanup(60_000);
    }
    await this.scheduleMessageExpiryAlarm();
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
    void this.scheduleEphemeralCleanup();
    void this.persistEphemeralToStorage();
    return state;
  }

  async fetch(request) {
    await this.ensureStorageHydrated();

    if (request.headers.get("Upgrade") === "websocket") {
      const [client, server] = Object.values(new WebSocketPair());
      try {
        await this.handleWebSocket(server, request);
      } catch (err) {
        logError("do.ws_handle_failed", err, {
          roomId: this.getRoomIdFromRequest(request) || this.roomId,
        });
        try {
          server.close(1011, "websocket_setup_failed");
        } catch {
          /* ignore */
        }
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    if (new URL(request.url).pathname === "/sse" && request.method === "GET") {
      const auth = await verifyJwtAndGetContext(request, this.env).catch(() => null);
      if (!auth) {
        return new Response("Unauthorized", { status: 401 });
      }
      const roomId = this.roomId || this.state.id.toString();
      await this.persistRoomContext(auth.projectId, roomId);
      const isMember = await canAccessRoom(this.env, auth, roomId);
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
        "SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at, mentions, og_title, og_description, og_image, og_url, client_message_id, kind, audio_url, duration_ms, transcription, transcription_status FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50"
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

    if (
      new URL(request.url).pathname === "/live-stats" &&
      request.method === "GET"
    ) {
      const snapshot = this.getPresenceSnapshot();
      return new Response(
        JSON.stringify({
          occupied: this.clients.size > 0,
          online: snapshot.online,
          subscriptionCount: snapshot.subscriptionCount,
          userCount: this.getActiveUserIds().length,
          users: snapshot.users,
          members: snapshot.members,
          socketIds: [...this.socketIds.values()],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      new URL(request.url).pathname === "/schedule-expiry" &&
      request.method === "POST"
    ) {
      await this.scheduleMessageExpiryAlarm();
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (new URL(request.url).pathname === "/terminate-socket" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const socketId =
        typeof body.socketId === "string"
          ? body.socketId
          : typeof body.socket_id === "string"
            ? body.socket_id
            : "";
      if (!socketId) {
        return new Response(JSON.stringify({ error: "socketId_required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const code = Number(body.code) || 4001;
      const reason =
        typeof body.reason === "string" && body.reason
          ? body.reason.slice(0, 120)
          : "terminated";
      const closed = this.terminateSocketConnection(socketId, code, reason);
      return new Response(JSON.stringify({ ok: true, closed, socketId }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (new URL(request.url).pathname === "/terminate-user" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const userId = typeof body.userId === "string" ? body.userId : "";
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId_required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const code = Number(body.code) || 4001;
      const reason =
        typeof body.reason === "string" && body.reason
          ? body.reason.slice(0, 120)
          : "terminated";
      const closed = this.terminateUserConnections(userId, code, reason);
      return new Response(JSON.stringify({ ok: true, closed }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (new URL(request.url).pathname === "/announce" && request.method === "POST") {
      const body = await request.json();
      const roomIdStr = this.state.id.toString();
      const broadcastOpts = {};
      if (typeof body.excludeSocketId === "string" && body.excludeSocketId) {
        broadcastOpts.excludeSocketId = body.excludeSocketId;
      } else if (typeof body.socket_id === "string" && body.socket_id) {
        broadcastOpts.excludeSocketId = body.socket_id;
      }
      if (Array.isArray(body.recipientUserIds) && body.recipientUserIds.length) {
        broadcastOpts.recipientUserIds = new Set(
          body.recipientUserIds.filter((id) => typeof id === "string" && id),
        );
      }
      if (body.type === "user_event") {
        this.broadcast(
          {
            type: "user_event",
            roomId: body.roomId || roomIdStr,
            userId: body.userId,
            name: body.name,
            data: body.data ?? {},
            at: body.at || new Date().toISOString(),
          },
          broadcastOpts,
        );
      } else if (body.type === "agentTyping") {
        this.broadcast(
          {
            type: "agentTyping",
            agentId: body.agentId || body.userId,
            isTyping: !!body.isTyping,
          },
          broadcastOpts,
        );
      } else if (body.type === "server_event") {
        this.broadcast(
          {
            type: "server_event",
            roomId: body.roomId || roomIdStr,
            name: body.name,
            data: body.data ?? {},
            userId: body.userId || "system",
          },
          broadcastOpts,
        );
      } else if (body.type === "capability_event") {
        this.broadcast(
          {
            type: "capability_event",
            roomId: body.roomId || roomIdStr,
            event: body.event ?? {},
          },
          broadcastOpts,
        );
      } else if (body.type === "edit") {
        this.broadcast({
          type: "edit",
          id: body.id,
          roomId: body.roomId || roomIdStr,
          userId: body.userId,
          content: body.content,
          editedAt: body.editedAt,
        }, broadcastOpts);
      } else if (body.type === "delete") {
        this.broadcast(
          {
            type: "delete",
            id: body.id,
            roomId: body.roomId || roomIdStr,
            userId: body.userId,
            deletedAt: body.deletedAt,
            ...(body.hard !== undefined ? { hard: !!body.hard } : {}),
          },
          broadcastOpts,
        );
      } else if (body.type === "reaction") {
        this.broadcast(
          {
            type: "reaction",
            roomId: body.roomId || roomIdStr,
            userId: body.userId,
            messageId: body.messageId,
            emoji: body.emoji,
            op: body.op,
          },
          broadcastOpts,
        );
      } else if (
        body.type === "tool_call" ||
        body.type === "tool_result" ||
        body.type === "tool_error"
      ) {
        this.broadcast(
          {
            type: body.type,
            roomId: body.roomId || roomIdStr,
            runId: body.runId,
            agentId: body.agentId,
            toolCallId: body.toolCallId,
            name: body.name,
            arguments: body.arguments,
            result: body.result,
            error: body.error,
          },
          broadcastOpts,
        );
      } else if (body.type === "delivery_updated") {
        this.broadcast(
          {
            type: "delivery_updated",
            roomId: body.roomId || roomIdStr,
            messageId: body.messageId,
            userId: body.userId,
            status: body.status,
          },
          broadcastOpts,
        );
      } else if (body.type === "poll_updated") {
        this.broadcast(
          {
            type: "poll_updated",
            roomId: body.roomId || roomIdStr,
            messageId: body.messageId,
            poll: body.poll,
            userId: body.userId,
          },
          broadcastOpts,
        );
      } else if (body.type === "message_pinned") {
        this.broadcast(
          {
            type: "message_pinned",
            roomId: body.roomId || roomIdStr,
            messageId: body.messageId ?? null,
            pinnedBy: body.pinnedBy,
            pinnedAt: body.pinnedAt ?? null,
          },
          broadcastOpts,
        );
      } else if (body.type === "message_updated") {
        this.broadcast(
          {
            type: "message_updated",
            roomId: body.roomId || roomIdStr,
            id: body.id,
            kind: body.kind,
            transcription: body.transcription ?? null,
            transcriptionStatus: body.transcriptionStatus ?? null,
            transcriptionModel: body.transcriptionModel,
          },
          broadcastOpts,
        );
      } else if (body.type === "agentRun" && body.run) {
        this.broadcast(
          {
            type: "agentRun",
            roomId: body.roomId || roomIdStr,
            run: body.run,
          },
          broadcastOpts,
        );
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
          ...(body.kind ? { kind: body.kind } : {}),
          ...(body.audioUrl ? { audioUrl: body.audioUrl } : {}),
          ...(body.audioMimeType ? { audioMimeType: body.audioMimeType } : {}),
          ...(body.audioSizeBytes != null ? { audioSizeBytes: body.audioSizeBytes } : {}),
          ...(body.durationMs != null ? { durationMs: body.durationMs } : {}),
          ...(body.transcription !== undefined ? { transcription: body.transcription } : {}),
          ...(body.transcriptionStatus !== undefined ? { transcriptionStatus: body.transcriptionStatus } : {}),
        };
        this.broadcast(payload, broadcastOpts);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Unsupported DO request", { status: 400 });
  }
}
