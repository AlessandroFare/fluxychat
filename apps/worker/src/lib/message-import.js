import { normalizeClientMessageId } from "./client-message-id.js";
import { fanoutPersistedMessage } from "./message-realtime-fanout.js";

const MAX_BATCH = 100;
const MAX_CONTENT_LENGTH = 32_000;

function parseCreatedAt(value) {
  if (value == null || value === "") return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { error: "invalid_created_at" };
  if (parsed.getTime() > Date.now() + 60_000) return { error: "created_at_in_future" };
  return parsed.toISOString();
}

export async function importAdminMessage(
  env,
  { projectId, roomId, content, userId, createdAt, clientMessageId, parentId, importedBy },
) {
  if (!roomId || typeof roomId !== "string") return { error: "room_id_required" };
  if (!content || typeof content !== "string") return { error: "content_required" };
  if (content.length > MAX_CONTENT_LENGTH) return { error: "content_too_long" };
  if (!userId || typeof userId !== "string") return { error: "user_id_required" };

  const room = await env.DB.prepare(
    "SELECT id FROM rooms WHERE project_id = ? AND id = ? LIMIT 1",
  )
    .bind(projectId, roomId)
    .first();
  if (!room) return { error: "room_not_found" };

  const createdAtResult = parseCreatedAt(createdAt);
  if (typeof createdAtResult === "object" && createdAtResult.error) return createdAtResult;
  const createdAtIso = createdAtResult;

  const normalizedClientId = normalizeClientMessageId(clientMessageId);
  if (normalizedClientId) {
    const existing = await env.DB.prepare(
      `SELECT id FROM messages
       WHERE project_id = ? AND room_id = ? AND client_message_id = ? AND deleted_at IS NULL
       LIMIT 1`,
    )
      .bind(projectId, roomId, normalizedClientId)
      .first();
    if (existing) {
      return { skipped: true, messageId: existing.id, clientMessageId: normalizedClientId };
    }
  }

  const parent = parentId != null ? Number(parentId) || null : null;
  const insertRes = await env.DB.prepare(
    `INSERT INTO messages (
      project_id, room_id, user_id, content, created_at, parent_id, client_message_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      projectId,
      roomId,
      userId,
      content,
      createdAtIso,
      parent,
      normalizedClientId,
    )
    .run();

  const messageId = insertRes.meta.last_row_id;

  await env.DB.prepare(
    `INSERT INTO admin_audit_log (project_id, action, actor_id, resource_type, resource_id, details, created_at)
     VALUES (?, 'message_import', ?, 'message', ?, ?, ?)`,
  )
    .bind(
      projectId,
      importedBy || userId,
      String(messageId),
      JSON.stringify({ roomId, clientMessageId: normalizedClientId, createdAt: createdAtIso }),
      new Date().toISOString(),
    )
    .run()
    .catch(() => {});

  await fanoutPersistedMessage(env, {
    projectId,
    roomId,
    messageId,
    userId,
    content,
    createdAt: createdAtIso,
    clientMessageId: normalizedClientId,
    parentId: parent,
    source: importedBy || "message_import",
  }).catch(() => {});

  return {
    imported: true,
    messageId,
    roomId,
    userId,
    createdAt: createdAtIso,
    clientMessageId: normalizedClientId,
  };
}

export async function importAdminMessageBatch(env, { projectId, messages, importedBy }) {
  if (!Array.isArray(messages)) return { error: "messages_array_required" };
  if (messages.length > MAX_BATCH) return { error: "batch_too_large", max: MAX_BATCH };

  const results = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of messages) {
    const result = await importAdminMessage(env, {
      projectId,
      roomId: row.roomId,
      content: row.content,
      userId: row.userId,
      createdAt: row.createdAt,
      clientMessageId: row.clientMessageId,
      parentId: row.parentId,
      importedBy,
    });
    if (result.error) {
      failed++;
      results.push({ ok: false, error: result.error, roomId: row.roomId });
    } else if (result.skipped) {
      skipped++;
      results.push({ ok: true, skipped: true, messageId: result.messageId });
    } else {
      imported++;
      results.push({ ok: true, messageId: result.messageId });
    }
  }

  return { imported, skipped, failed, results };
}
