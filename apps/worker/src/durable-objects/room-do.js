import { verifyJwtAndGetContext } from "../lib/jwt-request.js";
import { FLUXY_MAX_WS_FRAME_CHARS } from "@fluxy-chat/protocol";
import { WsSessionRegistry, installWsAutoResponse } from "../lib/do-ws-sessions.js";
import {
  emptyLedger,
  recordWsFrameIn,
  recordWsFrameOut,
  recordDoRequest,
  recordAlarm as recordAlarmCost,
  merge as mergeLedger,
  costView,
} from "../lib/room-cost-ledger.js";
import {
  isValidClientWsPayload,
  isValidLocationTrackEnded,
  isValidLocationUpdate,
} from "../lib/ws-protocol.js";
import {
  isReadonlyAllowedClientType,
  isReadonlyWsConnect,
  readonlyConnectionError,
} from "../lib/ws-readonly.js";
import { logInfo, logError } from "../lib/worker-log.js";
import {
  backoffMsForFailure,
  classifyDoFailure,
  runDoAlarmStep,
} from "../lib/do-retry-taxonomy.js";
import {
  scheduleDoAlarmJob,
  cancelDoAlarmJob,
  takeDueDoAlarmJobs,
} from "../lib/do-alarm-scheduler.js";
import {
  captureRoomPitrSnapshot,
  listRoomPitr,
  restoreRoomPitr,
} from "../lib/room-pitr.js";
import {
  AGENT_SCHEDULE_ALARM_JOB,
  cancelAgentSchedule,
  claimDueAgentSchedules,
  completeAgentScheduleFire,
  earliestAgentScheduleDueAt,
  ensureAgentSchedulesSql,
  fireAgentSchedule,
  serializeSchedule,
  upsertAgentSchedule,
  withAgentScheduleRows,
} from "../lib/agent-schedules.js";
import { parseRpcRequest, ROOM_RPC_METHODS } from "../lib/do-rpc.js";
import { callAgentDo } from "../lib/agent-do-session.js";
import { isRoomMember, canAccessRoom } from "../lib/room-access.js";
import { guestMemberRoleForJoin } from "../lib/guest-auth.js";
import { attachAttachmentsToMessages } from "../lib/messages-attachments.js";
import { attachPollsToMessages } from "../lib/message-polls.js";
import { expandMentions, mentionHandlesForAgentInvoke } from "../lib/message-mentions.js";
import { checkAndConsumeProjectQuota } from "../lib/project-plan-quota.js";
import { validateMessageContent, validateStreamStartContent } from "../lib/message-validation.js";
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
import { getLinkPreview } from "../lib/rich-previews.js";
import { deliverWebhooks } from "../lib/webhook-delivery.js";
import { normalizeClientMessageId } from "../lib/client-message-id.js";
import { safeSchedulePostMessageAutomations } from "../lib/post-message-automations-safe.js";
import { invokeMentionedAgents } from "../lib/agent-runtime.js";
import {
  buildPresenceMembers,
  buildRoomPresenceSnapshot,
  listActivePresenceUserIds,
  normalizeClientEventName,
  parsePresenceInfoParam,
  sanitizePresencePatch,
  shouldSkipClientEventWebhook,
  CLIENT_EVENT_MAX_PER_MINUTE,
  CURSOR_MAX_PER_MINUTE,
} from "../lib/room-presence.js";
import {
  sanitizeDerivedState,
  DERIVED_SET_MAX_PER_MINUTE,
} from "../lib/room-derived.js";
import { buildStageSnapshot, pickActiveSpeaker } from "../lib/room-voice-stage.js";
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
import {
  syncMessageDeleteToYjsRoomDoc,
  syncMessageEditToYjsRoomDoc,
  syncMessageToYjsRoomDoc,
  getMessageCrdtSnapshotPayload,
} from "../lib/yjs-message-list.js";
import {
  getGameCheckpointCrdtSnapshotPayload,
  syncCheckpointToYjsRoomDoc,
} from "../lib/yjs-game-checkpoint.js";
import { maybeSyncMatrixOutboundForMessage } from "../lib/matrix-outbound-hook.js";
import { streamCheckpoint, streamTail } from "../lib/stream-offset.js";

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
/**
 * Room-scoped (not socket-scoped) live state that must survive a hibernation
 * wake. Socket-scoped state lives in the socket attachment instead — see
 * `lib/do-ws-sessions.js`.
 */
export const EPHEMERAL_ROOM_STATE_KEY = "_ephemeral_room_state";

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
  {
    version: 3,
    name: "hibernatable_websockets",
    up: async () => {
      // Sockets are now accepted through the WebSocket Hibernation API, so
      // per-socket identity moved from in-memory Maps into the socket
      // attachment, and room-scoped live state (voice stage, active streams,
      // location tracks) persists under EPHEMERAL_ROOM_STATE_KEY so a woken
      // object can rebuild it. Nothing to rewrite: the new shape is created
      // lazily on first write, and an absent key means "empty room state".
    },
  },
  {
    version: 4,
    name: "agent_schedules_sql",
    up: async ({ state }) => {
      const sql = state?.storage?.sql;
      if (sql && typeof sql.exec === "function") {
        ensureAgentSchedulesSql(sql);
      }
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
  let readonly = false;
  try {
    const url = new URL(request.url);
    cache = parseCacheConnectParam(url.searchParams.get("cache"));
    readonly = isReadonlyWsConnect({
      queryReadonly: url.searchParams.get("readonly"),
      queryMode: url.searchParams.get("mode"),
    });
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
  return { replay, limit, cache, readonly };
}

export class RoomDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    /**
     * Hibernation-safe socket registry.
     *
     * Sockets are accepted through `state.acceptWebSocket()` so the runtime can
     * evict this object from memory between frames. Cloudflare bills Durable
     * Object duration for the entire time a socket accepted with `accept()` is
     * connected; hibernation removes that charge. Consequence: per-socket state
     * cannot live in an in-memory Map any more, because the Map is gone after a
     * wake while the socket is still open. The registry keeps that state in the
     * socket attachment and exposes Map/Set-compatible views so the call sites
     * below are unchanged.
     */
    this.sessions = new WsSessionRegistry(state, {
      onAttachmentOverflow: ({ bytes, field }) =>
        logError("do.ws_attachment_overflow", new Error("attachment budget exceeded"), {
          bytes,
          field,
          roomId: this.roomId || undefined,
        }),
    });

    /** Live sockets. Derived from `state.getWebSockets()`, correct after a wake. */
    this.clients = this.sessions.socketSet();
    /** @type {Map<string, MessageEvent[]>} SSE writers cannot survive hibernation. */
    this.sseClients = new Set();
    this.moderationCache = new Map();
    /** Per-socket user id (attachment field `u`). */
    this.userIds = this.sessions.field("u");
    this.projectId = null;
    this.roomId = null;
    this.wsRateLimitStore = new Map();
    /** @type {Map<string, { messageId: number, lastFlushMs: number }>} */
    this.activeStreams = new Map();
    /** @type {Map<WebSocket, MessageEvent[]>} */
    this.wsInboundQueues = new Map();
    /** Optional profile payload from `presenceInfo` WS query param. */
    this.userInfoByUserId = new Map();
    /** Per-connection id (exclude-sender / debugging), attachment field `s`. */
    this.socketIds = this.sessions.field("s");
    /** @type {Map<WebSocket, Record<string, boolean | undefined>>} attachment field `c` */
    this.wsCapabilities = this.sessions.field("c");
    /** @type {Map<WebSocket, string[]>} attachment field `r` */
    this.wsRoles = this.sessions.field("r");
    /** Spectator sockets (`ro: 1`) receive events but cannot publish. */
    this.wsReadonly = this.sessions.field("ro");
    /** @type {{ event: Record<string, unknown>; cachedAt: string } | null} */
    this.lastCacheEntry = null;
    /** @type {Map<string, { role: string, displayName?: string, vadScore?: number, lastVadAt?: number, joinedAt: string }>} */
    this.stageByUserId = new Map();
    this.activeSpeakerUserId = null;
    this.maxStageSpeakers = 5;
    /** Ephemeral last-known foreground location per track. */
    this.locationTracks = new Map();
    /** JSON bag sent on connect so late joiners render without replaying the log. */
    this.derivedState = {};
    this.derivedSeq = 0;
    /** Last accepted update time per user/track, enforcing the 1 Hz ceiling. */
    this.locationUpdateTimes = new Map();
    /** @type {Map<string, number>} */
    this.speculativeWarmupThrottle = new Map();
    /** @type {Map<string, object>} */
    this.speculativeWarmupCache = new Map();
    /** @type {YjsSyncHandler} */
    this.yjsSync = new YjsSyncHandler();

    // Runtime-level ping/pong. Auto-responses are answered without waking the
    // object, so client heartbeats cost neither duration nor a billed request.
    this.autoResponseInstalled = installWsAutoResponse(state);

    // F1 live marginal cost ledger. Snapshot persists in DO storage so counters
    // survive eviction; merged additively on wake.
    this.costLedger = emptyLedger();
    this.costLedgerKey = "_cost_ledger";

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
        // F1: restore cost counters from before the last eviction.
        const storedCost = await this.state.storage.get(this.costLedgerKey);
        if (storedCost) mergeLedger(this.costLedger, storedCost);
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
    // Room-scoped live state. Without this, a hibernation wake would silently
    // drop the voice stage, in-flight agent streams and location tracks while
    // clients still believe they are active.
    const roomRaw = await this.state.storage.get(EPHEMERAL_ROOM_STATE_KEY);
    if (roomRaw && typeof roomRaw === "object" && !Array.isArray(roomRaw)) {
      if (roomRaw.stage && typeof roomRaw.stage === "object") {
        this.stageByUserId = new Map(Object.entries(roomRaw.stage));
      }
      if (typeof roomRaw.activeSpeakerUserId === "string") {
        this.activeSpeakerUserId = roomRaw.activeSpeakerUserId;
      }
      if (roomRaw.activeStreams && typeof roomRaw.activeStreams === "object") {
        this.activeStreams = new Map(Object.entries(roomRaw.activeStreams));
      }
      if (roomRaw.locationTracks && typeof roomRaw.locationTracks === "object") {
        this.locationTracks = new Map(Object.entries(roomRaw.locationTracks));
      }
      if (roomRaw.userInfoByUserId && typeof roomRaw.userInfoByUserId === "object") {
        this.userInfoByUserId = new Map(Object.entries(roomRaw.userInfoByUserId));
      }
      if (roomRaw.derived && typeof roomRaw.derived === "object" && !Array.isArray(roomRaw.derived)) {
        this.derivedState = roomRaw.derived;
      }
      if (typeof roomRaw.derivedSeq === "number" && Number.isFinite(roomRaw.derivedSeq)) {
        this.derivedSeq = roomRaw.derivedSeq;
      }
    }
  }

  /**
   * Persist room-scoped live state so it survives eviction.
   * Socket-scoped state needs no explicit save: it rides the attachment.
   */
  async persistRoomStateToStorage() {
    if (!this.state.storage) return;
    const hasDerived =
      this.derivedState &&
      typeof this.derivedState === "object" &&
      Object.keys(this.derivedState).length > 0;
    const hasState =
      this.stageByUserId.size ||
      this.activeStreams.size ||
      this.locationTracks.size ||
      this.userInfoByUserId.size ||
      this.activeSpeakerUserId ||
      hasDerived;
    if (!hasState) {
      await this.state.storage.delete(EPHEMERAL_ROOM_STATE_KEY);
      return;
    }
    await this.state.storage.put(EPHEMERAL_ROOM_STATE_KEY, {
      stage: Object.fromEntries(this.stageByUserId),
      activeSpeakerUserId: this.activeSpeakerUserId,
      activeStreams: Object.fromEntries(this.activeStreams),
      locationTracks: Object.fromEntries(this.locationTracks),
      userInfoByUserId: Object.fromEntries(this.userInfoByUserId),
      derived: this.derivedState ?? {},
      derivedSeq: this.derivedSeq ?? 0,
    });
  }

  /**
   * Number of live sockets belonging to a user.
   *
   * Derived from the socket registry rather than a stored counter: a counter in
   * memory would reset on a hibernation wake and report every returning user as
   * a fresh join, emitting duplicate `member_joined` events.
   *
   * @param {string} userId
   */
  countUserConnections(userId) {
    let n = 0;
    for (const ws of this.sessions.sockets()) {
      const att = this.sessions.read(ws);
      if (att?.u === userId && !att?.ro) n++;
    }
    return n;
  }

  /**
   * Backwards-compatible view of the old `userConnectionCounts` Map.
   * Read-only and always derived from live sockets.
   */
  get userConnectionCounts() {
    const counts = new Map();
    for (const ws of this.sessions.sockets()) {
      const att = this.sessions.read(ws);
      const uid = att?.u;
      if (typeof uid !== "string" || att?.ro) continue;
      counts.set(uid, (counts.get(uid) || 0) + 1);
    }
    return counts;
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
    await this.persistRoomStateToStorage();
  }

  getActiveUserIds() {
    return listActivePresenceUserIds(this.userIds, this.userConnectionCounts);
  }

  /**
   * R6 presence-aware AI cost control.
   *
   * A user is "backgrounded" when they hold at least one live socket and every
   * one of those sockets reported `presence_state: "background"`. Users with no
   * sockets are NOT backgrounded (they are simply offline — different policy).
   *
   * @param {string} userId
   * @returns {boolean}
   */
  isUserBackgrounded(userId) {
    let sockets = 0;
    for (const ws of this.sessions.socketsByTag(`user:${userId}`)) {
      sockets += 1;
      if (this.sessions.read(ws)?.st !== "background") return false;
    }
    return sockets > 0;
  }

  getPresenceSnapshot() {
    const userIds = this.getActiveUserIds();
    let live = 0;
    for (const ws of this.sessions.sockets()) {
      if (!this.sessions.read(ws)?.ro) live += 1;
    }
    return buildRoomPresenceSnapshot(userIds, this.userInfoByUserId, live);
  }

  getStageSnapshot() {
    return buildStageSnapshot(this.stageByUserId, this.activeSpeakerUserId);
  }

  broadcastStageState(options = {}) {
    const roomIdStr = this.roomId || this.state.id.toString();
    this.broadcast(
      {
        type: "stage_updated",
        roomId: roomIdStr,
        stage: this.getStageSnapshot(),
      },
      options,
    );
  }

  refreshActiveSpeaker() {
    const next = pickActiveSpeaker(this.stageByUserId);
    if (next === this.activeSpeakerUserId) return;
    this.activeSpeakerUserId = next;
    const roomIdStr = this.roomId || this.state.id.toString();
    this.broadcast({
      type: "active_speaker",
      roomId: roomIdStr,
      userId: next,
    });
  }

  removeUserFromStage(userId) {
    if (!userId || !this.stageByUserId.has(userId)) return false;
    this.stageByUserId.delete(userId);
    if (this.activeSpeakerUserId === userId) {
      this.activeSpeakerUserId = pickActiveSpeaker(this.stageByUserId);
    }
    this.broadcastStageState();
    if (this.activeSpeakerUserId) {
      const roomIdStr = this.roomId || this.state.id.toString();
      this.broadcast({
        type: "active_speaker",
        roomId: roomIdStr,
        userId: this.activeSpeakerUserId,
      });
    }
    return true;
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

  syncYjsMessage(message, op = "upsert") {
    const roomId = this.roomId || this.state.id.toString();
    const syncFn =
      op === "delete"
        ? syncMessageDeleteToYjsRoomDoc
        : op === "edit"
          ? syncMessageEditToYjsRoomDoc
          : syncMessageToYjsRoomDoc;
    const broadcastFn = (frame) => this.broadcastBinary(frame);
    void syncFn(this.yjsSync, roomId, this.state.storage, message, broadcastFn).catch((err) =>
      logError("yjs.message_sync_failed", err, { roomId, messageId: message.id }),
    );
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

  /**
   * Called right after a socket joins (its `u` attachment is already set), so
   * the live socket count is the authoritative connection count for that user.
   * @param {string} userId
   */
  incrementUserConnection(userId) {
    return Math.max(1, this.countUserConnections(userId));
  }

  /**
   * Called from close/error handling after the socket has been forgotten, so the
   * remaining live socket count is the post-disconnect count.
   * @param {string} userId
   */
  decrementUserConnection(userId) {
    return this.countUserConnections(userId);
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
    // Hibernation API: the runtime may evict this object between frames, which
    // is what removes the per-connection duration charge. `accept()` would pin
    // the object in memory for the whole connection lifetime instead.
    // Tags let us fan out to one user's sockets without scanning attachments.
    // Cloudflare allows up to 10 tags, 256 chars each.
    const tags = [
      `user:${auth.userId}`,
      ...(auth.roles ?? []).map((r) => `role:${r}`),
    ];
    this.sessions.accept(webSocket, tags);
    const auth = await verifyJwtAndGetContext(request, this.env).catch((err) => {
      logError("do.ws_jwt_verify_failed", err, {});
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
    const authz = await runFluxyRoomAuthz(roomId, auth, { env: this.env });
    if (authz.action === "block") {
      webSocket.close(1008, String(authz.reason).slice(0, 120));
      return;
    }

    const userId = auth.userId;
    const socketId = crypto.randomUUID();
    const connectOptsEarly = parseWsConnectOptions(request);
    const spectator = isReadonlyWsConnect({
      queryReadonly: connectOptsEarly.readonly ? "1" : "",
      roles: auth.roles,
      capabilities: authz.capabilities,
    });

    // Persist identity/authorisation into the socket attachment in a single
    // write, BEFORE any await that could be followed by an eviction. A woken
    // object reads this back instead of a lost in-memory Map.
    this.sessions.write(webSocket, {
      u: userId,
      s: socketId,
      c: spectator
        ? { ...(authz.capabilities ?? {}), publish: false }
        : (authz.capabilities ?? {}),
      r: auth.roles ?? [],
      p: auth.projectId,
      ...(spectator ? { ro: 1 } : {}),
    });

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

    logInfo("do.client_count", {
      roomId: this.state.id.toString(),
      wsClients: this.clients.size,
      sseClients: this.sseClients.size,
      hibernatable: this.sessions.hibernationEnabled,
    });

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
    const userConnCount = spectator ? 0 : this.incrementUserConnection(userId);
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

    // Frames that arrive while the handshake below is still running are queued
    // by `webSocketMessage` and drained once setup completes, preserving order.
    const inboundQueue = [];
    this.wsInboundQueues.set(webSocket, inboundQueue);

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
          readonly: Boolean(spectator),
          subscriptionCount: presence.subscriptionCount,
          kind: presence.kind,
          count: presence.count,
          members: presence.members,
          derived: this.derivedState ?? {},
          derivedSeq: this.derivedSeq ?? 0,
        }),
      );
    } catch (err) {
      logError("do.ws_send_subscription_succeeded_failed", err, { roomId });
    }

    if (this.stageByUserId.size > 0) {
      try {
        webSocket.send(
          JSON.stringify({
            type: "stage_updated",
            roomId: roomIdStr,
            stage: this.getStageSnapshot(),
          }),
        );
      } catch {
        /* ignore */
      }
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
      kind: presence.kind,
      count: presence.count,
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

    // Room-scoped state may have changed during the handshake (presence info,
    // recovered users). Persist so a wake right after connect is consistent.
    void this.persistRoomStateToStorage().catch((err) =>
      logError("do.persist_room_state_failed", err, { roomId }),
    );
  }

  // ── WebSocket Hibernation API handlers ────────────────────────────────────
  //
  // With `state.acceptWebSocket()` the runtime dispatches frames to these
  // methods instead of to `addEventListener` closures. That indirection is the
  // whole point: closures capture the object in memory and defeat eviction,
  // while these methods can be invoked on a freshly reconstructed instance.

  /**
   * @param {WebSocket} webSocket
   * @param {string | ArrayBuffer} message
   */
  async webSocketMessage(webSocket, message) {
    // A frame can arrive on a woken object before any handshake ran in this
    // isolate. Storage hydration must complete first or the handler would see
    // an empty room context.
    await this.ensureStorageHydrated();

    // F1: every inbound WS frame is a billable unit (20:1 ratio) — count it,
    // and attribute handler wall-clock to the room's duration ledger.
    recordWsFrameIn(this.costLedger);
    const __costStart = Date.now();
    try {
      await this.#webSocketMessageInner(webSocket, message);
    } finally {
      const __costDelta = Date.now() - __costStart;
      if (__costDelta > 0) this.costLedger.handlerDurationMs += __costDelta;
      this.costLedger.lastEventMs = Date.now();
    }
  }

  async #webSocketMessageInner(webSocket, message) {

    const queue = this.wsInboundQueues.get(webSocket);
    if (queue) {
      // Handshake still in flight: preserve arrival order.
      queue.push({ data: message });
      return;
    }
    await this.onMessage(webSocket, { data: message });
  }

  /**
   * @param {WebSocket} webSocket
   * @param {number} code
   * @param {string} reason
   * @param {boolean} wasClean
   */
  async webSocketClose(webSocket, code, reason, wasClean) {
    await this.ensureStorageHydrated();
    try {
      this.onClose(webSocket);
    } finally {
      void this.persistRoomStateToStorage().catch(() => {});
    }
  }

  /**
   * @param {WebSocket} webSocket
   * @param {unknown} error
   */
  async webSocketError(webSocket, error) {
    await this.ensureStorageHydrated();
    logError("do.ws_error", error instanceof Error ? error : new Error(String(error)), {
      roomId: this.roomId || undefined,
    });
    try {
      this.onClose(webSocket);
    } finally {
      void this.persistRoomStateToStorage().catch(() => {});
    }
  }

  /**
   * @param {WebSocket} webSocket
   * @param {{ projectId: string, roomId: string, limit: number, envelopeType: "history" | "replay" }} opts
   */
  async loadConnectSnapshotRows(projectId, roomId, limit, viewerUserId, extendedSchema) {
    const { getMessageVisibilityFilter } = await import("../lib/message-visibility.js");
    const vis = await getMessageVisibilityFilter(this.env, roomId, viewerUserId || "");
    const voiceCols = extendedSchema
      ? ", kind, audio_url, duration_ms, transcription, transcription_status"
      : "";
    const visibilityCols = extendedSchema ? ", visibility, visible_to_json" : "";
    const result = await this.env.DB.prepare(
      `SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at,
              mentions, og_title, og_description, og_image, og_url, client_message_id,
              seq, version
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
      mapped = await attachPollsToMessages(this.env, projectId, mapped, viewerUserId);
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
  async sendActiveStreamState(webSocket, { projectId, roomId, streamOffsets = {} }) {
    for (const [ownerId, stream] of this.activeStreams.entries()) {
      if (!stream?.messageId) continue;
      let full = typeof stream.content === "string" ? stream.content : "";
      if (!full) {
        const row = await this.env.DB.prepare(
          "SELECT id, user_id, content, created_at, parent_id FROM messages WHERE id = ? AND project_id = ? AND room_id = ? AND deleted_at IS NULL",
        )
          .bind(stream.messageId, projectId, roomId)
          .first();
        if (!row) continue;
        full = row.content ?? "";
        const clientOffset = streamOffsets[String(stream.messageId)] ?? streamOffsets[stream.messageId];
        const tail = streamTail(full, clientOffset);
        webSocket.send(
          JSON.stringify({
            type: "streamState",
            messageId: row.id,
            roomId,
            userId: row.user_id,
            content: tail.content,
            offset: tail.offset,
            resumeFrom: tail.resumeFrom,
            createdAt: row.created_at,
            parentId: row.parent_id ? Number(row.parent_id) || null : null,
            streaming: true,
          }),
        );
        continue;
      }
      const clientOffset = streamOffsets[String(stream.messageId)] ?? streamOffsets[stream.messageId];
      const tail = streamTail(full, clientOffset);
      if (tail.caughtUp) continue;
      webSocket.send(
        JSON.stringify({
          type: "streamState",
          messageId: stream.messageId,
          roomId,
          userId: ownerId,
          content: tail.content,
          offset: tail.offset,
          resumeFrom: tail.resumeFrom,
          createdAt: stream.createdAt || new Date().toISOString(),
          parentId: stream.parentId ?? null,
          streaming: true,
        }),
      );
    }
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

      const contentValidation = validateStreamStartContent(content ?? "");
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
      const checkpoint = streamCheckpoint(initialContent);
      this.activeStreams.set(userId, {
        messageId: newMessageId,
        lastFlushMs: Date.now(),
        content: checkpoint.content,
        offset: checkpoint.offset,
        createdAt,
        parentId: parentId ? Number(parentId) || null : null,
      });
      void this.persistRoomStateToStorage().catch(() => {});

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

    if (op === "delta" || op === "end" || op === "stop") {
      const state = this.activeStreams.get(userId);
      let mid = Number(messageId);
      if (op === "stop" && state && (!Number.isFinite(mid) || mid <= 0)) {
        mid = Number(state.messageId);
        if (content == null || String(content).trim() === "") {
          content = state.content || "";
        }
      }
      if (!state || state.messageId !== mid) {
        return { ok: false, error: "stream_not_active" };
      }

      const contentValidation =
        op === "stop"
          ? validateStreamStartContent(content ?? state.content ?? "")
          : validateMessageContent(content ?? "");
      if (!contentValidation.valid) {
        return { ok: false, error: `invalid_content: ${contentValidation.error}` };
      }

      const now = new Date().toISOString();
      const nextContent = contentValidation.content;
      const checkpoint = streamCheckpoint(nextContent);
      state.content = checkpoint.content;
      state.offset = checkpoint.offset;
      const isFinal = op === "end" || op === "stop";
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
      void this.persistRoomStateToStorage().catch(() => {});

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
        void this.persistRoomStateToStorage().catch(() => {});
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
      void this.persistRoomStateToStorage().catch(() => {});
      return { ok: true, id: mid };
    }

    return { ok: false, error: "invalid_stream_op" };
  }

  async onMessage(webSocket, event) {
    if (this.sessions.read(webSocket)?.ro) {
      if (event.data instanceof ArrayBuffer) {
        webSocket.send(JSON.stringify(readonlyConnectionError()));
        return;
      }
    }

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
      if (typeof event.data === "string" && event.data.length > FLUXY_MAX_WS_FRAME_CHARS) {
        webSocket.send(
          JSON.stringify({ type: "error", message: "payload_too_large" }),
        );
        return;
      }
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

      if (this.sessions.read(webSocket)?.ro && !isReadonlyAllowedClientType(msg.type)) {
        webSocket.send(JSON.stringify(readonlyConnectionError()));
        return;
      }

      if (msg.type === "resume") {
        const roomId = this.roomId || this.state.id.toString();
        const projectId = this.projectId;
        const lastSeq = Math.max(0, Number(msg.lastSeq) || 0);
        try {
          const { getRoomMessageEventsSince, getRoomCurrentSeq } = await import(
            "../lib/room-message-seq.js"
          );
          const replay = await getRoomMessageEventsSince(this.env, {
            projectId,
            roomId,
            afterSeq: lastSeq,
          });
          const currentSeq = await getRoomCurrentSeq(this.env, projectId, roomId);
          webSocket.send(
            JSON.stringify({
              type: "replay",
              events: replay.events,
              lastSeq: replay.lastSeq,
              currentSeq,
            }),
          );
        } catch (err) {
          logError("do.resume_replay_failed", err, { roomId, projectId });
          webSocket.send(JSON.stringify({ type: "error", message: "resume_failed" }));
        }
        try {
          await this.sendActiveStreamState(webSocket, {
            projectId,
            roomId,
            streamOffsets: msg.streamOffsets && typeof msg.streamOffsets === "object" ? msg.streamOffsets : {},
          });
        } catch (err) {
          logError("do.stream_offset_resume_failed", err, { roomId, projectId });
        }
        return;
      }

      if (msg.type === "message") {
        const roomId = this.roomId || this.state.id.toString();
        const { id, userId, content, parentId, attachments } = msg;
        const clientMessageId = normalizeClientMessageId(msg.clientMessageId);
        const { resolveMessageExpiryWithRoomPolicy } = await import(
          "../lib/message-retention-room.js"
        );
        const expiryResult = await resolveMessageExpiryWithRoomPolicy(
          this.env,
          this.projectId,
          roomId,
          msg,
        );
        if (!expiryResult.ok) {
          webSocket.send(
            JSON.stringify({ type: "error", message: expiryResult.error }),
          );
          return;
        }
        const messageExpiresAt = expiryResult.expiresAt;
        const { resolveMessageVisibility, resolveVisibilityRecipientUserIds } =
          await import("../lib/message-visibility.js");
        const visibilityResult = resolveMessageVisibility(msg);
        if (!visibilityResult.ok) {
          webSocket.send(
            JSON.stringify({ type: "error", message: visibilityResult.error }),
          );
          return;
        }

        if (this.projectId) {
          const { assertProjectWriteResidency } = await import(
            "../lib/data-residency-settings.js"
          );
          const residencyCheck = await assertProjectWriteResidency(this.env, this.projectId, {
            operation: "message_create",
          });
          if (!residencyCheck.ok) {
            webSocket.send(
              JSON.stringify({
                type: "error",
                message: "data_residency_violation",
                code: "data_residency_violation",
              }),
            );
            return;
          }
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
          { userId: this.userIds.get(webSocket) ?? userId, projectId: this.projectId },
          validatedContent,
          {
            capabilities: this.wsCapabilities.get(webSocket) ?? {},
            replyTo: parentId ?? null,
            attachments,
            env: this.env,
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

        const { runRoomFirmwareHook } = await import("../lib/room-firmware.js");
        const firmwareResult = await runRoomFirmwareHook(this.env, {
          projectId: this.projectId,
          roomId,
          userId: this.userIds.get(webSocket) ?? userId,
          eventType: "message.create",
          event: { content: validatedContent, clientMessageId },
        });
        if (firmwareResult.action === "veto") {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: firmwareResult.reason ?? "firmware_veto",
              code: "firmware_veto",
              moduleId: firmwareResult.moduleId,
              retryAfterSeconds: firmwareResult.retryAfterSeconds,
            }),
          );
          return;
        }
        validatedContent = firmwareResult.content ?? validatedContent;

        const { tryDispatchSlashCommand } = await import("../lib/room-command-dispatch.js");
        const slashDispatch = await tryDispatchSlashCommand(this.env, {
          projectId: this.projectId,
          roomId,
          userId: this.userIds.get(webSocket) ?? userId,
          content: validatedContent,
          jwtRoles: this.wsRoles.get(webSocket) ?? [],
          parentId: parentId ?? null,
          clientMessageId,
        });
        if (slashDispatch.handled) {
          if (!slashDispatch.ok) {
            webSocket.send(
              JSON.stringify({ type: "error", message: slashDispatch.error, command: true }),
            );
            return;
          }
          if (slashDispatch.message) {
            webSocket.send(
              JSON.stringify({
                type: "message",
                ...slashDispatch.message,
                command: true,
              }),
            );
          } else if (slashDispatch.commandResult?.action === "clear") {
            webSocket.send(
              JSON.stringify({ type: "command_ack", action: "clear", ok: true }),
            );
          }
          return;
        }

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
        const mentionsRaw = extractMentions(validatedContent);
        const presenceForMentions = this.getPresenceSnapshot();
        const mentions = await expandMentions(this.env, {
          projectId,
          roomId,
          authorUserId: userId,
          tokens: mentionsRaw,
          onlineUserIds: presenceForMentions.users,
        });
        const firstUrl = extractFirstUrl(validatedContent);
        let preview = null;
        if (firstUrl && this.env.OG_PREVIEW_ENABLED !== "false") {
          preview = await getLinkPreview(this.env, { projectId, url: firstUrl });
          if (!preview) {
            preview = await fetchOgPreview(firstUrl, this.env);
          }
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

        const agentHandles = mentionHandlesForAgentInvoke(mentionsRaw);
        if (!isDuplicateResend && agentHandles.length) {
          void invokeMentionedAgents(
            this.env,
            projectId,
            roomId,
            userId,
            validatedContent,
            agentHandles,
            undefined,
            parentId || null,
          ).catch((err) =>
            logError("agent.mention_invoke_error", err, { projectId, roomId }),
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

        let messageSeq = null;
        let messageVersion = 1;
        if (!isDuplicateResend) {
          try {
            const { recordRoomMessageEvent } = await import("../lib/room-message-seq.js");
            const recorded = await recordRoomMessageEvent(this.env, {
              projectId,
              roomId,
              messageId,
              eventType: "create",
              version: 1,
              payload: {
                id: messageId,
                content: validatedContent,
                userId,
                createdAt,
                clientMessageId: clientMessageId ?? null,
              },
            });
            messageSeq = recorded?.seq ?? null;
          } catch (err) {
            logError("do.message_seq_create_failed", err, { roomId, messageId });
          }
        } else {
          const existingSeq = await this.env.DB.prepare(
            "SELECT seq, version FROM messages WHERE id = ? AND project_id = ? AND room_id = ?",
          )
            .bind(messageId, projectId, roomId)
            .first();
          messageSeq = existingSeq?.seq ?? null;
          messageVersion = existingSeq?.version ?? 1;
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
          ...(messageSeq != null ? { seq: messageSeq, version: messageVersion } : {}),
          ...(visibility !== "room"
            ? { visibility, ...(visibleTo.length ? { visibleTo } : {}) }
            : {}),
          ...(middlewareResult.meta ? { middleware: middlewareResult.meta } : {}),
        };

        const scopedRecipients = await resolveVisibilityRecipientUserIds(
          this.env,
          roomId,
          visibility,
          visibleTo,
          userId,
        );
        this.broadcast(
          payload,
          scopedRecipients ? { recipientUserIds: scopedRecipients } : {},
        );

        if (!isDuplicateResend) {
          this.syncYjsMessage({
            id: messageId,
            roomId,
            userId,
            senderId: userId,
            content: validatedContent,
            createdAt,
            parentId: parentId || null,
            clientMessageId,
          });
        }

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
        const socketUserId = this.userIds.get(webSocket) || msg.userId;
        const projectId = this.projectId;
        const op = String(msg.op || "");
        const parentId = msg.parentId ? Number(msg.parentId) || null : null;
        const targetUserId =
          op === "stop" && typeof msg.targetUserId === "string" && msg.targetUserId.trim()
            ? msg.targetUserId.trim()
            : socketUserId;

        if (!socketUserId || !projectId) {
          webSocket.send(
            JSON.stringify({ type: "error", message: "stream_requires_authenticated_socket" })
          );
          return;
        }

        if (op === "stop" && targetUserId !== socketUserId && !this.activeStreams.has(targetUserId)) {
          webSocket.send(JSON.stringify({ type: "error", message: "stream_not_active" }));
          return;
        }

        const result = await this.processStreamOp({
          projectId,
          roomId,
          userId: targetUserId,
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
        const projectId = this.projectId;
        const { userId, messageId, content } = msg;
        const now = new Date().toISOString();

        const existing = await this.env.DB.prepare(
          "SELECT version, seq FROM messages WHERE id = ? AND project_id = ? AND room_id = ? AND deleted_at IS NULL",
        )
          .bind(messageId, projectId, roomId)
          .first();
        const nextVersion = (existing?.version ?? 1) + 1;

        await this.env.DB.prepare(
          "UPDATE messages SET content = ?, edited_at = ?, version = ? WHERE id = ? AND room_id = ? AND user_id = ?",
        )
          .bind(content, now, nextVersion, messageId, roomId, userId)
          .run();

        let eventSeq = existing?.seq ?? null;
        try {
          const { recordRoomMessageEvent } = await import("../lib/room-message-seq.js");
          const recorded = await recordRoomMessageEvent(this.env, {
            projectId,
            roomId,
            messageId,
            eventType: "update",
            version: nextVersion,
            payload: {
              id: messageId,
              content,
              userId,
              editedAt: now,
              version: nextVersion,
            },
          });
          eventSeq = recorded?.seq ?? eventSeq;
        } catch (err) {
          logError("do.message_seq_update_failed", err, { roomId, messageId });
        }

        const payload = {
          type: "edit",
          id: messageId,
          roomId,
          userId,
          content,
          editedAt: now,
          streaming: false,
          version: nextVersion,
          ...(eventSeq != null ? { seq: eventSeq } : {}),
        };
        this.broadcast(payload);
        this.broadcast({
          type: "message_updated",
          id: messageId,
          roomId,
          userId,
          content,
          editedAt: now,
          version: nextVersion,
          ...(eventSeq != null ? { seq: eventSeq } : {}),
        });
        this.syncYjsMessage(
          {
            id: messageId,
            roomId,
            userId,
            content,
            createdAt: now,
            editedAt: now,
          },
          "edit",
        );
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
          "SELECT id, user_id, created_at, client_message_id, seq, version FROM messages WHERE id = ? AND project_id = ? AND room_id = ? AND deleted_at IS NULL",
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
          "UPDATE messages SET deleted_at = ?, content = ?, version = COALESCE(version, 1) + 1 WHERE id = ? AND project_id = ? AND user_id = ?",
        )
          .bind(now, "[deleted]", messageId, projectId, userId)
          .run();

        const deletedVersion = (existing.version ?? 1) + 1;
        let deleteSeq = existing.seq ?? null;
        try {
          const { recordRoomMessageEvent } = await import("../lib/room-message-seq.js");
          const recorded = await recordRoomMessageEvent(this.env, {
            projectId,
            roomId,
            messageId,
            eventType: "delete",
            version: deletedVersion,
            payload: {
              id: messageId,
              userId,
              deletedAt: now,
              version: deletedVersion,
            },
          });
          deleteSeq = recorded?.seq ?? deleteSeq;
        } catch (err) {
          logError("do.message_seq_delete_failed", err, { roomId, messageId });
        }

        this.broadcast({
          type: "delete",
          id: messageId,
          roomId,
          userId,
          deletedAt: now,
          version: deletedVersion,
          ...(deleteSeq != null ? { seq: deleteSeq } : {}),
        });
        this.broadcast({
          type: "message_deleted",
          id: messageId,
          roomId,
          userId,
          deletedAt: now,
          version: deletedVersion,
          ...(deleteSeq != null ? { seq: deleteSeq } : {}),
        });
        this.syncYjsMessage(
          {
            id: messageId,
            roomId,
            userId,
            content: "[deleted]",
            createdAt: existing.created_at ?? now,
            deletedAt: now,
            clientMessageId: existing.client_message_id ?? null,
          },
          "delete",
        );
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
        if (!shouldSkipClientEventWebhook(normalized.eventName)) {
          void deliverWebhooks(this.env, this.projectId, "client_event", {
            roomId,
            userId,
            eventName: normalized.eventName,
            data: msg.data ?? null,
          }).catch((err) => logError("webhook.client_event_failed", err, { roomId }));
        }
        return;
      }

      if (msg.type === "stage_join") {
        const userId = this.userIds.get(webSocket);
        if (!userId) {
          webSocket.send(JSON.stringify({ type: "error", message: "stage_requires_auth" }));
          return;
        }
        const role = msg.role === "speaker" ? "speaker" : "listener";
        const existing = this.stageByUserId.get(userId);
        if (role === "speaker" && existing?.role !== "speaker") {
          const speakerCount = [...this.stageByUserId.values()].filter((m) => m.role === "speaker").length;
          if (speakerCount >= this.maxStageSpeakers) {
            webSocket.send(JSON.stringify({ type: "error", message: "stage_speaker_limit" }));
            return;
          }
        }
        this.stageByUserId.set(userId, {
          role,
          displayName:
            typeof msg.displayName === "string" ? msg.displayName.trim().slice(0, 64) : undefined,
          joinedAt: new Date().toISOString(),
          vadScore: existing?.vadScore ?? 0,
          lastVadAt: existing?.lastVadAt ?? 0,
        });
        this.broadcastStageState();
        return;
      }

      if (msg.type === "stage_leave") {
        const userId = this.userIds.get(webSocket);
        if (!userId) return;
        this.removeUserFromStage(userId);
        return;
      }

      if (msg.type === "stage_vad") {
        const userId = this.userIds.get(webSocket);
        if (!userId) return;
        const meta = this.stageByUserId.get(userId);
        if (!meta || meta.role !== "speaker") return;
        const vadRate = this.consumeWsRateLimit(
          `stage-vad:${this.projectId}:${this.roomId}:${userId}`,
          30,
          60_000,
        );
        if (!vadRate.allowed) return;
        const score = Math.max(0, Math.min(1, Number(msg.score) || 0));
        meta.vadScore = score;
        meta.lastVadAt = Date.now();
        this.stageByUserId.set(userId, meta);
        this.refreshActiveSpeaker();
        return;
      }

      if (msg.type === "stage_promote") {
        const actorId = this.userIds.get(webSocket);
        const targetUserId = typeof msg.targetUserId === "string" ? msg.targetUserId.trim() : "";
        if (!actorId || !targetUserId) return;
        const actor = this.stageByUserId.get(actorId);
        if (!actor || actor.role !== "speaker") {
          webSocket.send(JSON.stringify({ type: "error", message: "stage_promote_forbidden" }));
          return;
        }
        const target = this.stageByUserId.get(targetUserId);
        if (!target || target.role !== "listener") return;
        const speakerCount = [...this.stageByUserId.values()].filter((m) => m.role === "speaker").length;
        if (speakerCount >= this.maxStageSpeakers) {
          webSocket.send(JSON.stringify({ type: "error", message: "stage_speaker_limit" }));
          return;
        }
        target.role = "speaker";
        this.stageByUserId.set(targetUserId, target);
        this.broadcastStageState();
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
        const partialText = typeof msg.partialText === "string" ? msg.partialText : "";
        void this.maybeRunSpeculativeWarmup(msg.userId, partialText, isTyping).catch(() => {});
        return;
      }

      if (msg.type === "cursor") {
        const roomId = this.roomId || this.state.id.toString();
        const userId = this.userIds.get(webSocket);
        if (!userId) {
          webSocket.send(JSON.stringify({ type: "error", message: "cursor_requires_auth" }));
          return;
        }
        const x = Number(msg.x);
        const y = Number(msg.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          webSocket.send(JSON.stringify({ type: "error", message: "cursor_invalid_position" }));
          return;
        }
        const cursorRate = this.consumeWsRateLimit(
          `cursor:${this.projectId}:${roomId}:${userId}`,
          CURSOR_MAX_PER_MINUTE,
          60_000,
        );
        if (!cursorRate.allowed) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: `rate_limit_exceeded: retry in ${cursorRate.retryAfterSeconds}s`,
            }),
          );
          return;
        }
        this.broadcast(
          {
            type: "cursor",
            roomId,
            userId,
            x,
            y,
            pointer: msg.pointer === "touch" ? "touch" : "mouse",
            color: typeof msg.color === "string" ? msg.color.slice(0, 32) : undefined,
            label: typeof msg.label === "string" ? msg.label.slice(0, 64) : undefined,
            ts: Date.now(),
          },
          { excludeWebSocket: webSocket },
        );
        return;
      }

      if (msg.type === "derived_set") {
        const roomId = this.roomId || this.state.id.toString();
        const userId = this.userIds.get(webSocket);
        if (!userId) {
          webSocket.send(JSON.stringify({ type: "error", message: "derived_requires_auth" }));
          return;
        }
        const derivedRate = this.consumeWsRateLimit(
          `derived:${this.projectId}:${roomId}:${userId}`,
          DERIVED_SET_MAX_PER_MINUTE,
          60_000,
        );
        if (!derivedRate.allowed) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: `rate_limit_exceeded: retry in ${derivedRate.retryAfterSeconds}s`,
            }),
          );
          return;
        }
        const sanitized = sanitizeDerivedState(msg.state);
        if (!sanitized.ok) {
          webSocket.send(JSON.stringify({ type: "error", message: sanitized.error }));
          return;
        }
        this.derivedState = sanitized.state;
        this.derivedSeq = (this.derivedSeq || 0) + 1;
        this.broadcast({
          type: "derived",
          roomId,
          userId,
          state: this.derivedState,
          seq: this.derivedSeq,
        });
        void this.persistRoomStateToStorage().catch(() => {});
        return;
      }

      if (msg.type === "presence_patch") {
        const roomId = this.roomId || this.state.id.toString();
        const userId = this.userIds.get(webSocket);
        if (!userId) {
          webSocket.send(JSON.stringify({ type: "error", message: "presence_requires_auth" }));
          return;
        }
        const sanitized = sanitizePresencePatch(msg);
        if (!sanitized.ok) {
          webSocket.send(JSON.stringify({ type: "error", message: sanitized.error }));
          return;
        }
        const presenceRate = this.consumeWsRateLimit(
          `presence:${this.projectId}:${roomId}:${userId}`,
          CURSOR_MAX_PER_MINUTE,
          60_000,
        );
        if (!presenceRate.allowed) {
          webSocket.send(
            JSON.stringify({
              type: "error",
              message: `rate_limit_exceeded: retry in ${presenceRate.retryAfterSeconds}s`,
            }),
          );
          return;
        }
        this.broadcast(
          {
            type: "presence_patch",
            roomId,
            userId,
            data: sanitized.data,
            ts: Date.now(),
          },
          { excludeWebSocket: webSocket },
        );
        return;
      }

      // R6 presence-aware AI cost control: the client reports tab visibility.
      // Stored per-socket in the attachment (survives hibernation). AI-side
      // spend for a fully-backgrounded user (speculative warmup) is skipped —
      // see maybeRunSpeculativeWarmup and isUserBackgrounded.
      if (msg.type === "presence_state") {
        const state = msg.state === "background" ? "background" : "active";
        this.sessions.write(webSocket, { st: state });
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
    // Read the identity BEFORE forgetting the socket: after `forget` the
    // attachment view no longer resolves and presence bookkeeping would be lost.
    const userId = this.userIds.get(webSocket);
    const wasReadonly = Boolean(this.sessions.read(webSocket)?.ro);
    const roomId = this.roomId || this.state.id.toString();
    this.yjsSync.removeClient(webSocket, roomId);
    this.wsInboundQueues.delete(webSocket);
    // Single call drops every per-socket field at once (identity, socket id,
    // capabilities, roles) and removes the socket from the live set.
    this.sessions.forget(webSocket);

    const roomIdStr = this.roomId || this.state.id.toString();
    let memberLeft = false;
    if (userId && !String(userId).startsWith("recovered:") && !wasReadonly) {
      void runFluxyDisconnectHooks(roomIdStr, userId, "close");
      const remaining = this.decrementUserConnection(userId);
      if (remaining === 0) {
        memberLeft = true;
        this.removeUserFromStage(userId);
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
      kind: presence.kind,
      count: presence.count,
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

    // OPTIMIZATION: when targeting specific users, use tag-based fanout
    // instead of scanning all clients and filtering by attachment.
    let targets;
    if (recipientUserIds && recipientUserIds.size > 0) {
      targets = [];
      for (const uid of recipientUserIds) {
        targets.push(...this.sessions.socketsByTag(`user:${uid}`));
      }
      // Deduplicate in case a socket has multiple matching tags
      targets = [...new Set(targets)];
    } else {
      targets = this.clients;
    }

    for (const client of targets) {
      if (excludeWebSocket && client === excludeWebSocket) continue;
      if (excludeSocketId) {
        const sid = this.socketIds.get(client);
        if (sid === excludeSocketId) continue;
      }
      if (recipientUserIds) {
        // Double-check: the tag lookup should already filter, but verify
        const uid = this.userIds.get(client);
        if (!uid || !recipientUserIds.has(uid)) continue;
      }
      try {
        client.send(payload);
        recordWsFrameOut(this.costLedger, 1);
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
      await cancelDoAlarmJob(this.state.storage, "ephemeral-cleanup");
      return;
    }
    await scheduleDoAlarmJob(
      this.state.storage,
      "ephemeral-cleanup",
      Date.now() + delayMs,
      "ephemeral-cleanup",
    );
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
    recordAlarmCost(this.costLedger);
    const step = await runDoAlarmStep(this.state, async () => {
      await takeDueDoAlarmJobs(this.state.storage);
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
      await this.processDueAgentSchedules();
    }, { reason: "alarm" });
    if (!step.ok && step.retry && this.state?.storage?.setAlarm) {
      const delay = backoffMsForFailure(step, 0);
      await scheduleDoAlarmJob(
        this.state.storage,
        "alarm-retry",
        Date.now() + delay,
        "alarm-retry",
      );
    }
    // F1: persist the cost snapshot while we are awake anyway (alarm fires are
    // the natural checkpoint between hibernation windows).
    await this.persistCostLedger();
    if (this.state?.storage) {
      await captureRoomPitrSnapshot(this.state.storage, { label: "alarm-checkpoint" });
    }
  }

  async armAgentScheduleAlarm() {
    if (!this.state?.storage) return;
    const dueAt = await withAgentScheduleRows(this.state.storage, (rows) => ({
      rows,
      dueAt: earliestAgentScheduleDueAt(rows),
    }));
    const when = dueAt?.dueAt;
    if (when == null) {
      await cancelDoAlarmJob(this.state.storage, AGENT_SCHEDULE_ALARM_JOB);
      return;
    }
    await scheduleDoAlarmJob(this.state.storage, AGENT_SCHEDULE_ALARM_JOB, when, AGENT_SCHEDULE_ALARM_JOB);
  }

  async processDueAgentSchedules() {
    if (!this.state?.storage) return;
    const claimed = [];
    await withAgentScheduleRows(this.state.storage, (rows) => {
      claimed.push(...claimDueAgentSchedules(rows, Date.now()));
      return { rows };
    });
    for (const schedule of claimed) {
      let fire;
      try {
        fire = await fireAgentSchedule(this.env, schedule);
      } catch (err) {
        const classified = classifyDoFailure(err);
        fire = {
          ok: false,
          error: classified.message,
          retry: classified.retry,
          delayMs: backoffMsForFailure(classified, schedule.failCount),
        };
      }
      if (fire && fire.ok === false && fire.retry == null && fire.error) {
        const classified = classifyDoFailure(new Error(String(fire.error)));
        fire.retry = classified.retry;
        fire.delayMs = backoffMsForFailure(classified, schedule.failCount);
      }
      await withAgentScheduleRows(this.state.storage, (rows) => {
        const row = rows.find((r) => r.id === schedule.id);
        if (row) {
          completeAgentScheduleFire(row, {
            ok: Boolean(fire?.ok),
            runId: fire?.runId || null,
            error: fire?.error || null,
            retry: fire?.retry !== false,
            delayMs: fire?.delayMs,
          });
        }
        return { rows };
      });
    }
    if (claimed.length) await this.armAgentScheduleAlarm();
  }

  /** Persist the F1 cost ledger so counters survive eviction. */
  async persistCostLedger() {
    if (!this.state?.storage) return;
    try {
      await this.state.storage.put(this.costLedgerKey, { ...this.costLedger });
    } catch (err) {
      logError("do.cost_ledger_persist_failed", err, {});
    }
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

  async maybeRunSpeculativeWarmup(userId, partialText, isTyping) {
    const {
      isSpeculativeWarmupEnabled,
      countWords,
      normalizeWarmupText,
      runSpeculativeRetrieval,
      buildWarmupCacheEntry,
      recordWarmupTelemetry,
      WARMUP_THROTTLE_MS,
      WARMUP_MIN_WORDS,
    } = await import("../lib/speculative-warmup.js");

    if (!isSpeculativeWarmupEnabled(this.env) || !this.projectId || !userId) return;

    // R6 presence-aware AI cost control: a user whose sockets are all
    // backgrounded cannot see the response, so pre-computing context for them
    // is pure token spend. Skip and discard any stale cache.
    if (this.isUserBackgrounded(userId)) {
      const stale = this.speculativeWarmupCache.get(userId);
      if (stale) stale.discarded = true;
      return;
    }

    const roomId = this.roomId || this.state.id.toString();

    if (!isTyping) {
      const cached = this.speculativeWarmupCache.get(userId);
      if (cached) cached.discarded = true;
      await recordWarmupTelemetry(this.env, {
        projectId: this.projectId,
        roomId,
        userId,
        outcome: "discarded",
      });
      return;
    }

    const text = normalizeWarmupText(partialText);
    if (countWords(text) < WARMUP_MIN_WORDS) return;

    const now = Date.now();
    const lastRun = this.speculativeWarmupThrottle.get(userId) ?? 0;
    if (now - lastRun < WARMUP_THROTTLE_MS) return;
    this.speculativeWarmupThrottle.set(userId, now);

    const result = await runSpeculativeRetrieval(this.env, {
      projectId: this.projectId,
      roomId,
      partialText: text,
    });
    if (!result.ok || !Array.isArray(result.results)) return;

    this.speculativeWarmupCache.set(
      userId,
      buildWarmupCacheEntry(text, result.results, now),
    );

    await recordWarmupTelemetry(this.env, {
      projectId: this.projectId,
      roomId,
      userId,
      outcome: "warmed",
      contextCount: result.results.length,
      partialLen: text.length,
    });
  }

  async consumeSpeculativeWarmup(userId, submittedText) {
    const { consumeWarmupCacheEntry, recordWarmupTelemetry } = await import("../lib/speculative-warmup.js");
    const roomId = this.roomId || this.state.id.toString();
    const cached = this.speculativeWarmupCache.get(userId);
    this.speculativeWarmupCache.delete(userId);

    const consumed = consumeWarmupCacheEntry(cached, submittedText);
    if (this.projectId) {
      await recordWarmupTelemetry(this.env, {
        projectId: this.projectId,
        roomId,
        userId,
        outcome: consumed.outcome,
        contextCount: consumed.results?.length ?? 0,
        partialLen: consumed.partialText?.length ?? 0,
      });
    }
    return consumed;
  }

  async fetch(request) {
    await this.ensureStorageHydrated();
    recordDoRequest(this.costLedger);

    // F1: live marginal cost for this room. Auth is enforced by the caller
    // (admin route); the DO itself sits on the private binding.
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === "/extensions" || requestUrl.pathname.startsWith("/extensions/")) {
      const { snapshotRoomExtensions, putRoomExtension } = await import("../lib/room-extensions.js");
      const storage = this.state?.storage;
      if (!storage) {
        return Response.json({ ok: false, error: "storage_unavailable" }, { status: 503 });
      }
      if (requestUrl.pathname === "/extensions" && request.method === "GET") {
        const ext = await snapshotRoomExtensions(storage);
        return Response.json({ ok: true, ext });
      }
      const extId = decodeURIComponent(requestUrl.pathname.split("/").pop() || "");
      if (request.method === "GET") {
        const ext = await snapshotRoomExtensions(storage);
        return Response.json({ ok: true, id: extId, record: ext[extId] ?? null, ext });
      }
      if (request.method === "PUT" || request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const declared = Array.isArray(body.declared) ? body.declared : undefined;
        const result = await putRoomExtension(storage, extId, body, declared);
        if (!result.ok) {
          return Response.json({ ok: false, error: result.error }, { status: result.status || 400 });
        }
        this.broadcast({ type: "extension_snapshot", ext: result.ext, id: extId });
        return Response.json(result);
      }
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    }

    if (new URL(request.url).pathname === "/cost") {
      await this.persistCostLedger();
      return Response.json({
        ok: true,
        roomId: this.roomId || this.state.id.toString(),
        projectId: this.projectId,
        ...costView(this.costLedger),
      });
    }

    // F5: read-only SQL over this room's own SQLite. The REST route enforces
    // JWT + room membership; here we only trust validateReadOnlySql as the
    // last line of defence before touching live state.
    if (new URL(request.url).pathname === "/sql" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { validateReadOnlySql, executeReadOnlySql } = await import("../lib/room-sql.js");
      const verdict = validateReadOnlySql(body.sql);
      if (!verdict.ok) {
        return Response.json({ ok: false, reason: verdict.reason }, { status: 400 });
      }
      const sqlite = this.state?.storage?.sql ?? null;
      const maxRows = Math.min(Math.max(Number(body.maxRows) || 200, 1), 1000);
      const result = executeReadOnlySql(sqlite, verdict.sql, maxRows);
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }

    if (new URL(request.url).pathname === "/pitr") {
      const storage = this.state?.storage;
      if (!storage) {
        return Response.json({ ok: false, reason: "storage_unavailable" }, { status: 503 });
      }
      if (request.method === "GET") {
        return Response.json(await listRoomPitr(storage));
      }
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const action = String(body.action || "").trim();
        if (action === "snapshot") {
          const captured = await captureRoomPitrSnapshot(storage, {
            label: body.label || "manual",
            actorUserId: body.actorUserId || null,
            force: true,
          });
          return Response.json(captured, { status: captured.ok ? 200 : 400 });
        }
        if (action === "restore") {
          const bookmark =
            typeof body.bookmark === "string"
              ? body.bookmark
              : typeof body.snapshotId === "string"
                ? ((await listRoomPitr(storage)).snapshots.find((s) => s.id === body.snapshotId) || {})
                    .bookmark
                : "";
          const restored = await restoreRoomPitr(storage, bookmark);
          return Response.json(restored, { status: restored.ok ? 200 : 400 });
        }
        return Response.json({ ok: false, reason: "action_required" }, { status: 400 });
      }
    }

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
        const mappedRaw = await attachAttachmentsToMessages(this.env, projectId, roomId, rows);
        const mapped = await attachPollsToMessages(this.env, projectId, mappedRaw, auth.userId);
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
      new URL(request.url).pathname === "/messages/crdt-snapshot" &&
      request.method === "GET"
    ) {
      const roomId = this.roomId || this.state.id.toString();
      const payload = await getMessageCrdtSnapshotPayload(
        this.yjsSync,
        roomId,
        this.state.storage,
      );
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      new URL(request.url).pathname === "/game-checkpoints/sync" &&
      request.method === "POST"
    ) {
      const roomId = this.roomId || this.state.id.toString();
      const body = await request.json().catch(() => ({}));
      if (body.checkpoint) {
        await syncCheckpointToYjsRoomDoc(
          this.yjsSync,
          roomId,
          this.state.storage,
          body.checkpoint,
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      new URL(request.url).pathname === "/game-checkpoints/crdt-snapshot" &&
      request.method === "GET"
    ) {
      const roomId = this.roomId || this.state.id.toString();
      const payload = await getGameCheckpointCrdtSnapshotPayload(
        this.yjsSync,
        roomId,
        this.state.storage,
      );
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      new URL(request.url).pathname === "/stage-sync" &&
      request.method === "POST"
    ) {
      const body = await request.json().catch(() => ({}));
      if (typeof body.maxSpeakers === "number" && body.maxSpeakers > 0) {
        this.maxStageSpeakers = Math.min(20, Math.floor(body.maxSpeakers));
      }
      if (body.enabled === false) {
        this.stageByUserId.clear();
        this.activeSpeakerUserId = null;
        this.broadcastStageState();
      }
      return new Response(JSON.stringify({ ok: true, stage: this.getStageSnapshot() }), {
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

    if (new URL(request.url).pathname === "/agent-schedules") {
      const storage = this.state?.storage;
      if (!storage) {
        return Response.json({ ok: false, reason: "storage_unavailable" }, { status: 503 });
      }
      if (request.method === "GET") {
        const listed = await withAgentScheduleRows(storage, (rows) => ({
          rows,
          schedules: rows
            .filter((r) => r.status !== "cancelled")
            .map(serializeSchedule),
        }));
        return Response.json({ ok: true, schedules: listed.schedules || [] });
      }
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const projectId = this.projectId || body.projectId;
        const roomId = this.roomId || this.state.id.toString();
        if (projectId && roomId) {
          await this.persistRoomContext(projectId, roomId);
        }
        const result = await withAgentScheduleRows(storage, (rows) =>
          upsertAgentSchedule(rows, {
            ...body,
            projectId,
            roomId,
          }),
        );
        if (!result.ok) {
          return Response.json({ ok: false, reason: result.reason }, { status: 400 });
        }
        await this.armAgentScheduleAlarm();
        return Response.json({
          ok: true,
          created: result.created,
          schedule: serializeSchedule(result.schedule),
        });
      }
      if (request.method === "DELETE") {
        const body = await request.json().catch(() => ({}));
        const scheduleId = String(body.scheduleId || body.id || "").trim();
        if (!scheduleId) {
          return Response.json({ ok: false, reason: "schedule_id_required" }, { status: 400 });
        }
        const result = await withAgentScheduleRows(storage, (rows) => cancelAgentSchedule(rows, scheduleId));
        if (!result.ok) {
          return Response.json({ ok: false, reason: result.reason }, { status: 404 });
        }
        await this.armAgentScheduleAlarm();
        return Response.json({ ok: true, schedule: serializeSchedule(result.schedule) });
      }
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

    if (
      new URL(request.url).pathname === "/speculative-warmup/consume" &&
      request.method === "POST"
    ) {
      const body = await request.json().catch(() => ({}));
      if (!body.userId || !body.submittedText) {
        return new Response(JSON.stringify({ error: "userId and submittedText required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const result = await this.consumeSpeculativeWarmup(body.userId, body.submittedText);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (new URL(request.url).pathname === "/rpc" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const parsed = parseRpcRequest(body, ROOM_RPC_METHODS);
      if (!parsed.ok) {
        return Response.json(parsed, { status: 400 });
      }
      if (parsed.method === "ping") {
        return Response.json({
          ok: true,
          method: "ping",
          roomId: this.roomId || this.state.id.toString(),
          projectId: this.projectId,
        });
      }
      if (parsed.method === "presence") {
        return Response.json({ ok: true, ...this.getPresenceSnapshot() });
      }
      if (parsed.method === "announce") {
        return this.fetch(
          new Request("https://internal/announce", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(parsed.params),
          }),
        );
      }
      if (parsed.method === "copilot_nudge") {
        const agentId = String(parsed.params.agentId || "").trim();
        const userId = String(parsed.params.userId || "").trim();
        const content = String(parsed.params.content || "").trim();
        if (!agentId || !userId || !content) {
          return Response.json({ ok: false, reason: "nudge_fields_required" }, { status: 400 });
        }
        const payload = await callAgentDo(
          this.env,
          {
            projectId: this.projectId || parsed.params.projectId,
            agentId,
            userId,
          },
          "turn",
          {
            content,
            projectId: this.projectId || parsed.params.projectId,
            agentId,
            userId,
            roomId: this.roomId || this.state.id.toString(),
            traceId: parsed.params.traceId,
          },
        );
        return Response.json(payload);
      }
      return Response.json({ ok: false, reason: "unknown_method" }, { status: 400 });
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
      } else if (body.type === "copilot_turn") {
        this.broadcast(
          {
            type: "copilot_turn",
            roomId: body.roomId || roomIdStr,
            agentId: body.agentId,
            userId: body.userId,
            runId: body.runId || null,
            content: body.content || null,
            status: body.status || null,
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
      } else if (body.type === "extension_snapshot") {
        this.broadcast(
          {
            type: "extension_snapshot",
            roomId: body.roomId || roomIdStr,
            ext: body.ext ?? {},
            id: body.id ?? null,
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
        this.syncYjsMessage(
          {
            id: body.id,
            roomId: body.roomId || roomIdStr,
            userId: body.userId,
            content: body.content,
            createdAt: body.editedAt || new Date().toISOString(),
            editedAt: body.editedAt,
          },
          "edit",
        );
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
        this.syncYjsMessage(
          {
            id: body.id,
            roomId: body.roomId || roomIdStr,
            userId: body.userId,
            content: "[deleted]",
            createdAt: body.deletedAt || new Date().toISOString(),
            deletedAt: body.deletedAt,
          },
          "delete",
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
            parentRunId: body.parentRunId ?? null,
            parentToolCallId: body.parentToolCallId ?? null,
            nestDepth: Number(body.nestDepth) || 0,
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
      } else if (body.type === "decision_updated") {
        this.broadcast(
          {
            type: "decision_updated",
            roomId: body.roomId || roomIdStr,
            messageId: body.messageId,
            decision: body.decision,
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
      } else if (body.type === "agent_step" && body.step) {
        this.broadcast(
          {
            type: "agent_step",
            roomId: body.roomId || roomIdStr,
            sessionId: body.sessionId,
            step: body.step,
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
        this.syncYjsMessage({
          id: messageId,
          roomId: rid,
          userId: payload.senderId,
          senderId: payload.senderId,
          content: payload.content,
          createdAt: payload.createdAt,
          parentId: payload.parentId,
          clientMessageId: body.clientMessageId ?? null,
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Unsupported DO request", { status: 400 });
  }
}
