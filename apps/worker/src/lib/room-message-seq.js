/**
 * Monotonic per-room message sequence + event log for reconnect resume.
 */

function nowIso() {
  return new Date().toISOString();
}

/**
 * Allocate the next seq for a room (atomic upsert).
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 */
export async function allocateRoomMessageSeq(env, projectId, roomId) {
  if (!env?.DB) return null;

  await env.DB.prepare(
    `INSERT INTO room_message_seq (project_id, room_id, last_seq)
     VALUES (?, ?, 1)
     ON CONFLICT(project_id, room_id) DO UPDATE SET last_seq = last_seq + 1`,
  )
    .bind(projectId, roomId)
    .run();

  const row = await env.DB.prepare(
    `SELECT last_seq FROM room_message_seq WHERE project_id = ? AND room_id = ?`,
  )
    .bind(projectId, roomId)
    .first();

  return row?.last_seq ?? null;
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   messageId: number,
 *   eventType: 'create' | 'update' | 'delete',
 *   version: number,
 *   payload: Record<string, unknown>,
 *   seq?: number | null,
 * }} input
 */
export async function recordRoomMessageEvent(env, input) {
  if (!env?.DB) return null;

  const seq =
    input.seq ??
    (await allocateRoomMessageSeq(env, input.projectId, input.roomId));
  if (seq == null) return null;

  const createdAt = nowIso();
  await env.DB.prepare(
    `INSERT INTO room_message_events
     (project_id, room_id, seq, message_id, event_type, version, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.projectId,
      input.roomId,
      seq,
      input.messageId,
      input.eventType,
      input.version,
      JSON.stringify(input.payload ?? {}),
      createdAt,
    )
    .run();

  if (input.eventType === "create" || input.eventType === "update") {
    await env.DB.prepare(
      `UPDATE messages SET seq = COALESCE(seq, ?), version = ? WHERE id = ? AND project_id = ? AND room_id = ?`,
    )
      .bind(seq, input.version, input.messageId, input.projectId, input.roomId)
      .run();
  }

  return { seq, version: input.version, createdAt };
}

/**
 * Replay events with seq > afterSeq for WS resume.
 * @param {*} env
 * @param {{ projectId: string, roomId: string, afterSeq?: number, limit?: number }} input
 */
export async function getRoomMessageEventsSince(env, input) {
  if (!env?.DB) return { events: [], lastSeq: 0 };

  const afterSeq = Math.max(0, Number(input.afterSeq) || 0);
  const limit = Math.min(Math.max(Number(input.limit) || 200, 1), 500);

  const { results } = await env.DB.prepare(
    `SELECT seq, message_id, event_type, version, payload_json, created_at
     FROM room_message_events
     WHERE project_id = ? AND room_id = ? AND seq > ?
     ORDER BY seq ASC LIMIT ?`,
  )
    .bind(input.projectId, input.roomId, afterSeq, limit)
    .all();

  const events = (results || []).map((row) => ({
    seq: row.seq,
    messageId: row.message_id,
    eventType: row.event_type,
    version: row.version,
    createdAt: row.created_at,
    payload: parsePayload(row.payload_json),
  }));

  const lastSeq = events.length ? events[events.length - 1].seq : afterSeq;
  return { events, lastSeq };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 */
export async function getRoomCurrentSeq(env, projectId, roomId) {
  if (!env?.DB) return 0;
  const row = await env.DB.prepare(
    `SELECT last_seq FROM room_message_seq WHERE project_id = ? AND room_id = ?`,
  )
    .bind(projectId, roomId)
    .first();
  return row?.last_seq ?? 0;
}

function parsePayload(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
