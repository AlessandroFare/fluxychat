/**
 * P26-A-1: Unified Chat API
 * Adapted from Vercel Chat SDK's chat.ts — top-level methods that auto-infer
 * adapter from thread ID prefix and return Thread-like objects.
 *
 * FluxyChat thread ID format: `adapter:channelId:messageId`
 * The prefix before the first `:` is the adapter slug.
 *
 * @example
 * ```js
 * import { chat } from "./chat-api.js";
 * const thread = chat.thread("slack:C123ABC:1234567890.123456");
 * await thread.post("Hello from outside a webhook!");
 * ```
 */

import { getAdapterInfo } from "./adapter-catalog.js";

// =============================================================================
// Thread ID Parsing
// =============================================================================

/**
 * Parse the adapter slug from a thread ID.
 * FluxyChat thread IDs are formatted as `adapter:channelId:messageId`.
 * @param {string} id - Thread or channel ID
 * @returns {string|null} adapter slug or null
 */
export function parseAdapterSlug(id) {
  if (!id || typeof id !== "string") return null;
  const idx = id.indexOf(":");
  if (idx === -1) return null;
  const slug = id.substring(0, idx);
  return slug || null;
}

/**
 * Resolve an adapter from a thread/channel ID by parsing the prefix.
 * @param {string} id - Thread or channel ID
 * @param {Object} [adapterRegistry] - Optional map of slug→adapter instance
 * @returns {Object|null} adapter info or null
 */
export function inferAdapterFromId(id, adapterRegistry) {
  const slug = parseAdapterSlug(id);
  if (!slug) return null;

  // If a runtime adapter registry is provided, return the live adapter
  if (adapterRegistry && adapterRegistry[slug]) {
    return adapterRegistry[slug];
  }

  // Otherwise return catalog metadata
  return getAdapterInfo(slug) ?? null;
}

// =============================================================================
// Thread Stub
// =============================================================================

/**
 * Lightweight Thread reference.
 * In FluxyChat, threads are managed by the Room DO. This object holds
 * the ID and adapter metadata, and delegates posting to the worker route.
 */
export class ThreadRef {
  /**
   * @param {Object} opts
   * @param {string} opts.id - Full thread ID
   * @param {string} opts.adapterSlug - Adapter slug (e.g. "slack", "web")
   * @param {string} [opts.channelId] - Channel ID portion
   * @param {Object} [opts.adapterInfo] - Adapter catalog info
   * @param {Object} [opts.context] - Worker context for posting (env, D1, etc.)
   */
  constructor({ id, adapterSlug, channelId, adapterInfo, context, roomId, created }) {
    this.id = id;
    this.adapterSlug = adapterSlug;
    this.channelId = channelId || id.split(":")[1] || null;
    this.roomId = roomId || (adapterSlug === "web" ? this.channelId : null);
    this.adapterInfo = adapterInfo;
    this._context = context;
    this.created = created;
  }

  /** Serialize to JSON */
  toJSON() {
    return {
      _type: "fluxy:Thread",
      id: this.id,
      adapterSlug: this.adapterSlug,
      channelId: this.channelId,
    };
  }

  /** Static factory from JSON */
  static fromJSON(data) {
    return new ThreadRef({
      id: data.id,
      adapterSlug: data.adapterSlug,
      channelId: data.channelId,
    });
  }
}

// =============================================================================
// Chat API
// =============================================================================

/**
 * Create a Chat API instance bound to a worker context.
 * The context provides access to D1, R2, KV, and the Room DO.
 *
 * @param {Object} context - Worker context { env, db, roomStub, ... }
 * @returns {Object} Chat API object
 */
export function createChatApi(context = {}) {
  /**
   * Get a Thread reference by thread ID.
   * Auto-infers adapter from ID prefix.
   * @param {string} threadId - Full thread ID (e.g. "web:room-123:msg-456")
   * @returns {ThreadRef}
   */
  function thread(threadId) {
    const slug = parseAdapterSlug(threadId);
    if (!slug) {
      throw new ChatApiError(
        `Invalid thread ID: ${threadId}`,
        "INVALID_THREAD_ID"
      );
    }

    const info = getAdapterInfo(slug);
    if (!info) {
      throw new ChatApiError(
        `Adapter "${slug}" not found for thread ID "${threadId}"`,
        "ADAPTER_NOT_FOUND"
      );
    }

    const parts = threadId.split(":");
    const channelId = parts.length > 1 ? parts.slice(1, -1).join(":") : undefined;

    return new ThreadRef({
      id: threadId,
      adapterSlug: slug,
      channelId,
      adapterInfo: info,
      context,
    });
  }

  /**
   * Open a DM with a user by user ID.
   * Auto-infers adapter from user ID format.
   * @param {string} userId - Platform-specific user ID
   * @returns {Promise<ThreadRef|null>} Thread reference or null
   */
  async function openDM(targetUserId, options = {}) {
    const slug = inferAdapterFromUserId(targetUserId);
    if (!slug) {
      throw new ChatApiError(
        `Cannot infer adapter from userId "${targetUserId}"`,
        "UNKNOWN_USER_ID_FORMAT"
      );
    }

    const info = getAdapterInfo(slug);
    if (!info) {
      throw new ChatApiError(
        `Adapter "${slug}" not in catalog`,
        "ADAPTER_NOT_FOUND"
      );
    }

    const callerUserId = options.userId || context.userId;

    if (slug === "web" && context.env && context.projectId && callerUserId) {
      const { findOrCreateDmRoom } = await import("./dm-rooms.js");
      const result = await findOrCreateDmRoom(context.env, {
        projectId: context.projectId,
        userA: callerUserId,
        userB: targetUserId,
      });
      if (!result.ok) {
        throw new ChatApiError(result.error || "dm_failed", "DM_CREATE_FAILED");
      }
      const roomId = result.room.id;
      return new ThreadRef({
        id: `web:${roomId}:`,
        adapterSlug: slug,
        channelId: roomId,
        roomId,
        adapterInfo: info,
        context,
        created: result.created,
      });
    }

    const adapterInstance = context.adapterRegistry?.[slug];
    if (adapterInstance && typeof adapterInstance.openDM === "function") {
      const threadId = await adapterInstance.openDM(targetUserId);
      return thread(threadId);
    }

    const threadId = `${slug}:dm:${targetUserId}`;
    return new ThreadRef({
      id: threadId,
      adapterSlug: slug,
      channelId: `dm:${targetUserId}`,
      adapterInfo: info,
      context,
    });
  }

  /**
   * Look up user info by user ID.
   * Auto-infers adapter from user ID format.
   * @param {string} userId - Platform-specific user ID
   * @returns {Promise<UserInfo|null>} User info or null
   */
  async function getUser(userId) {
    const slug = inferAdapterFromUserId(userId);
    if (!slug) {
      throw new ChatApiError(
        `Cannot infer adapter from userId "${userId}"`,
        "UNKNOWN_USER_ID_FORMAT"
      );
    }

    // For web adapter, look up from D1
    if (slug === "web" && context.db) {
      const user = await context.db
        .prepare("SELECT id, email, name, avatar_url FROM users WHERE id = ?")
        .bind(userId)
        .first();
      if (!user) return null;
      return {
        userId: user.id,
        email: user.email,
        fullName: user.name,
        avatarUrl: user.avatar_url,
        adapter: "web",
      };
    }

    // For other adapters, return minimal info
    return {
      userId,
      adapter: slug,
    };
  }

  return { thread, openDM, getUser };
}

// =============================================================================
// User ID Inference
// =============================================================================

const SLACK_USER_ID_REGEX = /^[UW][A-Z0-9]+$/;
const DISCORD_SNOWFLAKE_REGEX = /^\d{17,19}$/;
const TEAMS_USER_ID_REGEX = /^29:/;
const GCHAT_USER_ID_REGEX = /^users\//;
const TELEGRAM_USER_ID_REGEX = /^\d{1,13}$/;

/**
 * Infer adapter slug from user ID format.
 * @param {string} userId
 * @returns {string|null}
 */
export function inferAdapterFromUserId(userId) {
  if (!userId || typeof userId !== "string") return null;

  // Google Chat: "users/..."
  if (GCHAT_USER_ID_REGEX.test(userId)) return "gchat";

  // Teams: "29:..."
  if (TEAMS_USER_ID_REGEX.test(userId)) return "teams";

  // Slack: "U..." or "W..."
  if (SLACK_USER_ID_REGEX.test(userId)) return "slack";

  // Discord: 17-19 digit snowflake
  if (DISCORD_SNOWFLAKE_REGEX.test(userId)) return "discord";

  // Telegram: numeric up to 13 digits
  if (TELEGRAM_USER_ID_REGEX.test(userId)) return "telegram";

  // Web adapter: UUID or custom format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return "web";
  }

  return null;
}

// =============================================================================
// Shutdown
// =============================================================================

/**
 * Shut down all registered adapters.
 * Calls `disconnect()` on each adapter, logs the shutdown.
 *
 * @param {Object} [registry] - Optional adapter registry (slug → adapter instance)
 * @param {Object} [logger] - Optional logger
 * @returns {Promise<{disconnected: string[], errors: Array<{name: string, error: string}>}>}
 */
export async function shutdownAdapters(registry, logger) {
  const disconnected = [];
  const errors = [];

  if (!registry || typeof registry !== "object") {
    // Use the global adapter registry from adapter.js
    const { listAdapters: _listAdapters, getAdapter: _getAdapter } = await import("./adapter.js");
    const adapters = _listAdapters();
    for (const { slug } of adapters) {
      const adapter = _getAdapter(slug);
      if (adapter && typeof adapter.disconnect === "function") {
        try {
          await adapter.disconnect();
          disconnected.push(slug);
        } catch (err) {
          errors.push({ name: slug, error: String(err?.message || err) });
        }
      }
    }
  } else {
    // Use the provided registry
    for (const [slug, adapter] of Object.entries(registry)) {
      if (adapter && typeof adapter.disconnect === "function") {
        try {
          await adapter.disconnect();
          disconnected.push(slug);
        } catch (err) {
          errors.push({ name: slug, error: String(err?.message || err) });
        }
      }
    }
  }

  const log = logger || console;
  log.info?.(`[shutdown] Disconnected ${disconnected.length} adapter(s)`, {
    disconnected,
    errors: errors.length,
  });

  return { disconnected, errors };
}

// =============================================================================
// Error
// =============================================================================

export class ChatApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ChatApiError";
    this.code = code;
  }
}

// =============================================================================
// Default singleton (no context — useful for ID parsing)
// =============================================================================

export const chat = {
  thread: (threadId) => {
    const slug = parseAdapterSlug(threadId);
    if (!slug) {
      throw new ChatApiError(`Invalid thread ID: ${threadId}`, "INVALID_THREAD_ID");
    }
    const info = getAdapterInfo(slug);
    if (!info) {
      throw new ChatApiError(
        `Adapter "${slug}" not found`,
        "ADAPTER_NOT_FOUND"
      );
    }
    const parts = threadId.split(":");
    const channelId = parts.length > 1 ? parts.slice(1, -1).join(":") : undefined;
    return new ThreadRef({ id: threadId, adapterSlug: slug, channelId, adapterInfo: info });
  },
  openDM: async (userId) => {
    const slug = inferAdapterFromUserId(userId);
    if (!slug) throw new ChatApiError(`Cannot infer adapter from userId "${userId}"`, "UNKNOWN_USER_ID_FORMAT");
    const info = getAdapterInfo(slug);
    if (!info) throw new ChatApiError(`Adapter "${slug}" not in catalog`, "ADAPTER_NOT_FOUND");
    return new ThreadRef({
      id: `${slug}:dm:${userId}`,
      adapterSlug: slug,
      channelId: `dm:${userId}`,
      adapterInfo: info,
    });
  },
  getUser: async (userId) => {
    const slug = inferAdapterFromUserId(userId);
    if (!slug) throw new ChatApiError(`Cannot infer adapter from userId "${userId}"`, "UNKNOWN_USER_ID_FORMAT");
    return { userId, adapter: slug };
  },
  shutdown: async (registry, logger) => shutdownAdapters(registry, logger),
};
