/** Marker stored in JSON payloads after GDPR erasure (not a real user id). */
export const GDPR_REDACTED_USER_MARKER = "[deleted]";

/** JSON object keys that may hold a single user identifier. */
export const GDPR_USER_ID_FIELD_KEYS = new Set([
  "userId",
  "fromUserId",
  "toUserId",
  "actorUserId",
  "memberUserId",
  "mentionedUserId",
  "senderId",
  "reporterUserId",
  "targetUserId",
]);

/** Keys whose values are arrays of user ids (e.g. mention fan-out). */
export const GDPR_USER_ID_ARRAY_KEYS = new Set(["toUserIds", "mentionedUserIds", "userIds"]);

/**
 * @param {unknown} value
 * @param {string} userId
 * @returns {unknown}
 */
export function redactUserReferencesInValue(value, userId) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value === userId ? GDPR_REDACTED_USER_MARKER : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactUserReferencesInValue(item, userId));
  }
  if (typeof value !== "object") return value;

  const out = /** @type {Record<string, unknown>} */ ({});
  for (const [key, child] of Object.entries(value)) {
    if (GDPR_USER_ID_FIELD_KEYS.has(key)) {
      if (typeof child === "string" && child === userId) {
        out[key] = GDPR_REDACTED_USER_MARKER;
        continue;
      }
    }
    if (GDPR_USER_ID_ARRAY_KEYS.has(key) && Array.isArray(child)) {
      out[key] = child.map((id) =>
        typeof id === "string" && id === userId ? GDPR_REDACTED_USER_MARKER : id
      );
      continue;
    }
    out[key] = redactUserReferencesInValue(child, userId);
  }
  return out;
}

/**
 * @param {string|null|undefined} jsonText
 * @param {string} userId
 * @returns {string|null}
 */
export function redactUserReferencesInJsonString(jsonText, userId) {
  if (jsonText == null || jsonText === "") return jsonText ?? null;
  const raw = String(jsonText);
  if (!raw.includes(userId)) return raw;
  try {
    const parsed = JSON.parse(raw);
    const redacted = redactUserReferencesInValue(parsed, userId);
    return JSON.stringify(redacted);
  } catch {
    return raw.split(userId).join(GDPR_REDACTED_USER_MARKER);
  }
}

/**
 * Deep-redact user id fields in D1 JSON payload columns (automation_events, webhook_deliveries).
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {object} opts
 * @param {string} opts.projectId
 * @param {string} opts.userId
 * @param {"automation_events"|"webhook_deliveries"} opts.table
 * @param {number} [opts.pageSize]
 * @returns {Promise<{ scanned: number, redacted: number }>}
 */
export async function redactUserPayloadsInTable(db, { projectId, userId, table, pageSize = 200 }) {
  const allowed = new Set(["automation_events", "webhook_deliveries"]);
  if (!allowed.has(table)) {
    throw new Error(`redactUserPayloadsInTable: unsupported table ${table}`);
  }

  const idColumn = table === "automation_events" ? "id" : "id";
  let offset = 0;
  let scanned = 0;
  let redacted = 0;

  while (true) {
    const page = await db
      .prepare(
        `SELECT ${idColumn} AS row_id, payload FROM ${table} WHERE project_id = ? AND payload LIKE ? LIMIT ? OFFSET ?`
      )
      .bind(projectId, `%${userId}%`, pageSize, offset)
      .all();

    const rows = page.results || [];
    if (!rows.length) break;

    const statements = [];
    const now = new Date().toISOString();

    for (const row of rows) {
      scanned += 1;
      const current = row.payload == null ? null : String(row.payload);
      const next = redactUserReferencesInJsonString(current, userId);
      if (next === current) continue;

      if (table === "webhook_deliveries") {
        statements.push(
          db
            .prepare(
              "UPDATE webhook_deliveries SET payload = ?, updated_at = ? WHERE id = ? AND project_id = ?"
            )
            .bind(next, now, row.row_id, projectId)
        );
      } else {
        statements.push(
          db
            .prepare(
              "UPDATE automation_events SET payload = ? WHERE id = ? AND project_id = ?"
            )
            .bind(next, row.row_id, projectId)
        );
      }
    }

    if (statements.length) {
      await db.batch(statements);
      redacted += statements.length;
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return { scanned, redacted };
}
