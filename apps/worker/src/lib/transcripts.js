/**
 * P22-F1: Transcripts API — cross-platform per-user message persistence in D1.
 *
 * Wire: admin routes (`/admin/transcripts`) and the SDK
 * `createTranscriptsApi({ worker })` transport. Project-scoped: a project only
 * ever reads its own users' transcripts. `retentionMs` sets an optional per-entry
 * TTL; `maxPerUser` trims the oldest entries on append (default 200).
 */

const DEFAULT_MAX_PER_USER = 200;
const DEFAULT_LIST_LIMIT = 50;

/** Keep rows readable by the SDK and this module. */
const LIVE = "(expires_at IS NULL OR expires_at > ?)";

function rowToEntry(row) {
  const entry = {
    id: row.id,
    userKey: row.user_key,
    role: row.role,
    text: row.text,
    platform: row.platform,
    threadId: row.thread_id,
    timestamp: row.timestamp,
  };
  if (row.platform_message_id) entry.platformMessageId = row.platform_message_id;
  return entry;
}

export class TranscriptsApiImpl {
  /**
   * @param {{ DB: D1Database }} env
   * @param {{ projectId?: string, maxPerUser?: number, retentionMs?: number }} config
   */
  constructor(env, config = {}) {
    this.env = env;
    this.projectId = config.projectId || "";
    this.maxPerUser = config.maxPerUser ?? DEFAULT_MAX_PER_USER;
    this.retentionMs = config.retentionMs;
  }

  /**
   * @param {{ userKey: string, role?: string, text: string, platform?: string, threadId?: string, platformMessageId?: string }} input
   */
  async append(input) {
    const entry = {
      id: crypto.randomUUID(),
      userKey: input.userKey,
      role: input.role || "user",
      text: input.text,
      platform: input.platform || "unknown",
      threadId: input.threadId || "",
      timestamp: Date.now(),
    };
    if (input.platformMessageId) entry.platformMessageId = input.platformMessageId;

    const expiresAt = this.retentionMs != null ? Date.now() + this.retentionMs : null;
    await this.env.DB.prepare(
      `INSERT INTO user_transcripts (id, project_id, user_key, role, text, platform, thread_id, timestamp, platform_message_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        entry.id,
        this.projectId,
        entry.userKey,
        entry.role,
        entry.text,
        entry.platform,
        entry.threadId,
        entry.timestamp,
        entry.platformMessageId || null,
        expiresAt,
        new Date().toISOString(),
      )
      .run();

    await this.enforceMaxPerUser(entry.userKey);
    return entry;
  }

  /**
   * Newest `limit` entries, oldest-first (matches the SDK in-memory API order).
   * @param {{ userKey: string, platforms?: string[], threadId?: string, roles?: string[], limit?: number }} query
   */
  async list(query) {
    let sql = `SELECT * FROM user_transcripts WHERE project_id = ? AND user_key = ? AND ${LIVE}`;
    const params = [this.projectId, query.userKey, Date.now()];

    if (query.platforms?.length) {
      sql += ` AND platform IN (${query.platforms.map(() => "?").join(",")})`;
      params.push(...query.platforms);
    }
    if (query.threadId) {
      sql += " AND thread_id = ?";
      params.push(query.threadId);
    }
    if (query.roles?.length) {
      sql += ` AND role IN (${query.roles.map(() => "?").join(",")})`;
      params.push(...query.roles);
    }

    sql = `SELECT * FROM (${sql} ORDER BY timestamp DESC LIMIT ?) ORDER BY timestamp ASC`;
    // Audit F-91: the caller-supplied limit was unbounded — one request could
    // read the whole transcript table.
    params.push(Math.min(Math.max(Number(query.limit ?? DEFAULT_LIST_LIMIT) || DEFAULT_LIST_LIMIT, 1), 500));

    const result = await this.env.DB.prepare(sql).bind(...params).all();
    return (result.results || []).map(rowToEntry);
  }

  async count({ userKey }) {
    const row = await this.env.DB.prepare(
      `SELECT COUNT(*) as count FROM user_transcripts WHERE project_id = ? AND user_key = ? AND ${LIVE}`
    )
      .bind(this.projectId, userKey, Date.now())
      .first();
    return row?.count || 0;
  }

  async delete({ userKey }) {
    const row = await this.env.DB.prepare(
      `SELECT COUNT(*) as count FROM user_transcripts WHERE project_id = ? AND user_key = ? AND ${LIVE}`
    )
      .bind(this.projectId, userKey, Date.now())
      .first();
    const previous = row?.count || 0;

    await this.env.DB.prepare(
      "DELETE FROM user_transcripts WHERE project_id = ? AND user_key = ?"
    )
      .bind(this.projectId, userKey)
      .run();

    return { deleted: previous };
  }

  async enforceMaxPerUser(userKey) {
    const count = await this.count({ userKey });
    if (count <= this.maxPerUser) return;

    const excess = count - this.maxPerUser;
    await this.env.DB.prepare(
      `DELETE FROM user_transcripts WHERE project_id = ? AND user_key = ? AND id IN (
         SELECT id FROM user_transcripts WHERE project_id = ? AND user_key = ? ORDER BY timestamp ASC LIMIT ?
       )`
    )
      .bind(this.projectId, userKey, this.projectId, userKey, excess)
      .run();
  }
}

/**
 * @param {{ DB: D1Database }} env
 * @param {{ projectId?: string, maxPerUser?: number, retentionMs?: number }} config
 */
export function createTranscriptsApi(env, config) {
  return new TranscriptsApiImpl(env, config);
}
