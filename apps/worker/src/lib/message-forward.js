/**
 * Message forwarding — copy a readable message into another room the actor can
 * post to. Attachments are copied as rows (R2 objects are shared by key), and
 * the new message carries `metadata.forwardedFrom`.
 */
import { mergeMessageExtras } from "./message-extras.js";
import { assertCanPostToRoom } from "./room-post-policy.js";
import { canAccessRoom } from "./room-access.js";
import { fanoutRoomInternal } from "./room-shard.js";

const MAX_FORWARD_ATTACHMENTS = 20;

export async function forwardMessage(env, {
  projectId,
  actorUserId,
  actorRoles = [],
  messageId,
  targetRoomId,
}) {
  const id = Number(messageId);
  if (
    !env?.DB ||
    !projectId ||
    !actorUserId ||
    !targetRoomId ||
    !Number.isFinite(id) ||
    id < 1
  ) {
    return { ok: false, error: "invalid_forward" };
  }

  const source = await env.DB.prepare(
    `SELECT id, room_id, user_id, content, kind, audio_url, duration_ms,
            transcription, og_title, og_description, og_image, og_url
       FROM messages
      WHERE id = ? AND project_id = ? AND deleted_at IS NULL
      LIMIT 1`,
  )
    .bind(id, projectId)
    .first();
  if (!source) return { ok: false, error: "message_not_found", status: 404 };

  const auth = { userId: actorUserId, projectId, roles: actorRoles };
  if (!(await canAccessRoom(env, auth, source.room_id))) {
    return { ok: false, error: "forbidden", status: 403 };
  }
  if (!(await canAccessRoom(env, auth, targetRoomId))) {
    return { ok: false, error: "forbidden_target_room", status: 403 };
  }
  const postPolicy = await assertCanPostToRoom(env, {
    projectId,
    roomId: targetRoomId,
    userId: actorUserId,
    jwtRoles: actorRoles,
  });
  if (!postPolicy.ok) {
    return {
      ok: false,
      error: postPolicy.error,
      status: postPolicy.status || 403,
    };
  }

  const sourceRoom = await env.DB.prepare(
    "SELECT name FROM rooms WHERE project_id = ? AND id = ? LIMIT 1",
  )
    .bind(projectId, source.room_id)
    .first();
  const forwardedFrom = {
    messageId: Number(source.id),
    roomId: source.room_id,
    roomName: sourceRoom?.name || source.room_id,
    authorId: source.user_id,
  };

  const extras = mergeMessageExtras(null, { forwardedFrom });
  const createdAt = new Date().toISOString();
  const insertRes = await env.DB.prepare(
    `INSERT INTO messages (
       project_id, room_id, user_id, content, created_at, kind, audio_url,
       duration_ms, transcription, og_title, og_description, og_image, og_url,
       metadata_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      projectId,
      targetRoomId,
      actorUserId,
      source.content,
      createdAt,
      source.kind || "text",
      source.audio_url ?? null,
      source.duration_ms ?? null,
      source.transcription ?? null,
      source.og_title ?? null,
      source.og_description ?? null,
      source.og_image ?? null,
      source.og_url ?? null,
      extras.json ?? null,
    )
    .run();
  const newMessageId = insertRes.meta.last_row_id;

  const attachments = await env.DB.prepare(
    "SELECT kind, url, name, size_bytes, content_type FROM attachments WHERE project_id = ? AND message_id = ? LIMIT ?",
  )
    .bind(projectId, id, MAX_FORWARD_ATTACHMENTS)
    .all();
  const attRows = attachments.results || [];
  if (attRows.length) {
    await env.DB.batch(
      attRows.map((a) =>
        env.DB.prepare(
          "INSERT INTO attachments (project_id, room_id, message_id, kind, url, name, size_bytes, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          projectId,
          targetRoomId,
          newMessageId,
          a.kind,
          a.url,
          a.name,
          a.size_bytes,
          a.content_type,
          createdAt,
        ),
      ),
    );
  }

  await fanoutRoomInternal(env, projectId, targetRoomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      roomId: targetRoomId,
      id: newMessageId,
      content: source.content,
      userId: actorUserId,
      senderId: actorUserId,
      createdAt,
      mentions: [],
      preview: null,
      attachments: attRows.map((a) => ({
        kind: a.kind,
        url: a.url,
        name: a.name,
        sizeBytes: a.size_bytes,
        contentType: a.content_type,
      })),
      forwardedFrom,
    }),
  });

  return {
    ok: true,
    message: {
      id: newMessageId,
      roomId: targetRoomId,
      userId: actorUserId,
      content: source.content,
      createdAt,
      forwardedFrom,
    },
  };
}
