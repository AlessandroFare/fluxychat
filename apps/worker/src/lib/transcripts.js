/**
 * P22-F1: Transcripts API
 * Adapted from Vercel Chat SDK's TranscriptsApiImpl.
 *
 * Cross-platform per-user message persistence:
 * - append(): Add message to transcript
 * - list(): Retrieve transcript messages
 * - count(): Count messages in transcript
 * - delete(): Remove messages from transcript
 *
 * Enables unified message history across platforms.
 * When a user switches from web to mobile to Slack, their transcript is continuous.
 */

// =============================================================================
// Transcript Types
// =============================================================================

/**
 * @typedef {'user' | 'assistant' | 'system'} TranscriptRole
 */

/**
 * @typedef {Object} TranscriptEntry
 * @property {string} id - UUID assigned at append time
 * @property {string} userKey - Cross-platform user key
 * @property {TranscriptRole} role
 * @property {string} text - Plain-text body
 * @property {string} platform - Originating adapter name
 * @property {string} threadId - Originating thread ID
 * @property {number} timestamp - ms-since-epoch
 * @property {string} [platformMessageId] - Platform-native message ID
 */

/**
 * @typedef {Object} AppendInput
 * @property {string} text
 * @property {TranscriptRole} role
 * @property {string} [platformMessageId]
 */

/**
 * @typedef {Object} AppendOptions
 * @property {string} userKey - Required when appending AppendInput
 */

/**
 * @typedef {Object} ListQuery
 * @property {string} userKey
 * @property {string[]} [platforms] - Filter by platform
 * @property {string} [threadId] - Filter by thread
 * @property {TranscriptRole[]} [roles] - Filter by role
 * @property {number} [limit] - Max entries to return (default: 50)
 */

/**
 * @typedef {Object} DeleteTarget
 * @property {string} userKey
 */

// =============================================================================
// Transcripts API
// =============================================================================

const KEY_PREFIX = "transcripts:user:";
const DEFAULT_MAX_PER_USER = 200;
const DEFAULT_LIST_LIMIT = 50;
const TOMBSTONE_MARKER = "__chatSdkTombstone";

/**
 * @typedef {Object} Tombstone
 * @property {true} __chatSdkTombstone
 */

/**
 * Check if a value is a tombstone marker.
 * @param {unknown} value
 * @returns {value is Tombstone}
 */
function isTombstone(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    value[TOMBSTONE_MARKER] === true
  );
}

export class TranscriptsApiImpl {
  /**
   * @param {import('./types.js').Env} env
   * @param {{ maxPerUser?: number, retentionMs?: number }} config
   */
  constructor(env, config = {}) {
    /** @type {import('./types.js').Env} */
    this.env = env;
    /** @type {number} */
    this.maxPerUser = config.maxPerUser ?? DEFAULT_MAX_PER_USER;
    /** @type {number | undefined} */
    this.retentionMs = config.retentionMs;
  }

  /**
   * Append a message to the user's transcript.
   * @param {string | { adapter?: { name: string }, id: string }} thread - Thread or thread ID
   * @param {import('./types.js').Message | AppendInput} message
   * @param {AppendOptions} [options]
   * @returns {Promise<TranscriptEntry | null>}
   */
  async append(thread, message, options) {
    const isMessage = message.text !== undefined && message.role !== undefined;

    let userKey;
    let role;
    let platformMessageId;
    let text;
    let threadId;
    let platform;

    if (isMessage) {
      userKey = message.userKey;
      role = message.role || "user";
      platformMessageId = message.id;
      text = message.text;
      threadId = typeof thread === "string" ? thread : thread.id;
      platform = typeof thread === "string" ? "unknown" : thread.adapter?.name || "unknown";
      if (!userKey) {
        return null;
      }
    } else {
      userKey = options?.userKey;
      role = message.role;
      platformMessageId = message.platformMessageId;
      text = message.text;
      threadId = typeof thread === "string" ? thread : thread.id;
      platform = typeof thread === "string" ? "unknown" : thread.adapter?.name || "unknown";
      if (!userKey) {
        throw new Error(
          "transcripts.append: options.userKey is required when appending an AppendInput"
        );
      }
    }

    const entry = {
      id: crypto.randomUUID(),
      userKey,
      role,
      text,
      platform,
      threadId,
      timestamp: Date.now(),
      platformMessageId,
    };

    // Store in D1 using append-to-list pattern
    const key = keyFor(userKey);
    await this.env.DB.prepare(
      `INSERT INTO user_transcripts (id, user_key, role, text, platform, thread_id, timestamp, platform_message_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        entry.id,
        entry.userKey,
        entry.role,
        entry.text,
        entry.platform,
        entry.threadId,
        entry.timestamp,
        entry.platformMessageId || null
      )
      .run();

    // Enforce max per user (trim oldest)
    await this.enforceMaxPerUser(userKey);

    return entry;
  }

  /**
   * List transcript messages for a user.
   * @param {ListQuery} query
   * @returns {Promise<TranscriptEntry[]>}
   */
  async list(query) {
    const { userKey, platforms, threadId, roles, limit } = query;
    const maxLimit = limit ?? DEFAULT_LIST_LIMIT;

    let sql = `SELECT * FROM user_transcripts WHERE user_key = ?`;
    /** @type {any[]} */
    const params = [userKey];

    if (platforms && platforms.length > 0) {
      const placeholders = platforms.map(() => "?").join(",");
      sql += ` AND platform IN (${placeholders})`;
      params.push(...platforms);
    }

    if (threadId) {
      sql += ` AND thread_id = ?`;
      params.push(threadId);
    }

    if (roles && roles.length > 0) {
      const placeholders = roles.map(() => "?").join(",");
      sql += ` AND role IN (${placeholders})`;
      params.push(...roles);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(maxLimit);

    const result = await this.env.DB.prepare(sql)
      .bind(...params)
      .all();

    return result.results.map((row) => ({
      id: row.id,
      userKey: row.user_key,
      role: row.role,
      text: row.text,
      platform: row.platform,
      threadId: row.thread_id,
      timestamp: row.timestamp,
      platformMessageId: row.platform_message_id,
    }));
  }

  /**
   * Count messages in a user's transcript.
   * @param {{ userKey: string }} query
   * @returns {Promise<number>}
   */
  async count(query) {
    const result = await this.env.DB.prepare(
      `SELECT COUNT(*) as count FROM user_transcripts WHERE user_key = ?`
    )
      .bind(query.userKey)
      .first();

    return result?.count || 0;
  }

  /**
   * Delete messages from a user's transcript.
   * @param {DeleteTarget} target
   * @returns {Promise<{ deleted: number }>}
   */
  async delete(target) {
    const key = keyFor(target.userKey);

    // Count existing entries
    const countResult = await this.env.DB.prepare(
      `SELECT COUNT(*) as count FROM user_transcripts WHERE user_key = ?`
    )
      .bind(target.userKey)
      .first();

    const previous = countResult?.count || 0;

    // Delete all entries for this user
    await this.env.DB.prepare(
      `DELETE FROM user_transcripts WHERE user_key = ?`
    )
      .bind(target.userKey)
      .run();

    return { deleted: previous };
  }

  /**
   * Enforce max entries per user by removing oldest.
   * @param {string} userKey
   */
  async enforceMaxPerUser(userKey) {
    const count = await this.count({ userKey });
    if (count <= this.maxPerUser) {
      return;
    }

    // Delete oldest entries
    const excess = count - this.maxPerUser;
    await this.env.DB.prepare(
      `DELETE FROM user_transcripts WHERE user_key = ? AND id IN (
        SELECT id FROM user_transcripts WHERE user_key = ? ORDER BY timestamp ASC LIMIT ?
      )`
    )
      .bind(userKey, userKey, excess)
      .run();
  }
}

/**
 * Generate storage key for user transcript.
 * @param {string} userKey
 * @returns {string}
 */
function keyFor(userKey) {
  return `${KEY_PREFIX}${userKey}`;
}

/**
 * Create a transcripts API instance.
 * @param {import('./types.js').Env} env
 * @param {{ maxPerUser?: number, retentionMs?: number }} config
 * @returns {TranscriptsApiImpl}
 */
export function createTranscriptsApi(env, config) {
  return new TranscriptsApiImpl(env, config);
}
