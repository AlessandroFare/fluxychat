import { canAccessRoom } from "./room-access.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function isProjectWideSearchRole(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => r === "owner" || r === "admin" || r === "moderator");
}

export function sanitizeFtsQuery(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.length > 200) return trimmed.slice(0, 200);
  return trimmed.replace(/[^\p{L}\p{N}\s"'_-]/gu, " ").replace(/\s+/g, " ").trim();
}

export async function searchMessages(env, input) {
  const q = sanitizeFtsQuery(input.query);
  if (!q) {
    return { ok: false, error: "query_required" };
  }

  const limit = Math.min(
    Math.max(Number(input.limit || DEFAULT_LIMIT), 1),
    MAX_LIMIT,
  );

  if (input.roomId) {
    const allowed = await canAccessRoom(
      env,
      {
        projectId: input.projectId,
        userId: input.userId,
        roles: input.roles,
      },
      input.roomId,
    );
    if (!allowed) {
      return { ok: false, error: "forbidden", status: 403 };
    }
  }

  const params = [];
  let sql = `
    SELECT m.id, m.room_id, m.user_id, m.content, m.created_at,
      snippet(messages_fts, 0, '[[', ']]', '…', 24) AS snippet
    FROM messages_fts
    JOIN messages m ON m.id = messages_fts.rowid
  `;

  if (input.roomId) {
    sql += `
      WHERE messages_fts MATCH ?
        AND m.project_id = ?
        AND m.room_id = ?
        AND m.deleted_at IS NULL
    `;
    params.push(q, input.projectId, input.roomId);
  } else if (isProjectWideSearchRole(input.roles)) {
    sql += `
      WHERE messages_fts MATCH ?
        AND m.project_id = ?
        AND m.deleted_at IS NULL
    `;
    params.push(q, input.projectId);
  } else {
    sql += `
      JOIN room_members rm ON rm.room_id = m.room_id AND rm.user_id = ?
      WHERE messages_fts MATCH ?
        AND m.project_id = ?
        AND m.deleted_at IS NULL
    `;
    params.push(input.userId, q, input.projectId);
  }

  if (input.from) {
    sql += " AND m.created_at >= ?";
    params.push(input.from);
  }
  if (input.to) {
    sql += " AND m.created_at < ?";
    params.push(input.to);
  }

  sql += " ORDER BY m.created_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const results = (rows.results || []).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    snippet: row.snippet || row.content,
  }));

  return { ok: true, results, query: q };
}
