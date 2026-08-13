/**
 * Persist room timeline audit events (approval_chain_updated, approval_requested, …).
 */

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   eventType: string,
 *   payload: Record<string, unknown>,
 *   createdBy?: string | null,
 * }} input
 */
export async function appendRoomTimelineEvent(env, input) {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  await env.DB.prepare(
    `INSERT INTO room_timeline_events (id, project_id, room_id, event_type, payload_json, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.projectId,
      input.roomId,
      input.eventType,
      JSON.stringify(input.payload ?? {}),
      createdAt,
      input.createdBy ?? null,
    )
    .run();

  return { id, eventType: input.eventType, createdAt, payload: input.payload };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, eventType?: string, limit?: number }} input
 */
export async function listRoomTimelineEvents(env, input) {
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 200);
  let sql = `SELECT id, event_type, payload_json, created_at, created_by
             FROM room_timeline_events WHERE project_id = ? AND room_id = ?`;
  const params = [input.projectId, input.roomId];
  if (input.eventType) {
    sql += ` AND event_type = ?`;
    params.push(input.eventType);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return (results || []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    payload: row.payload_json ? JSON.parse(row.payload_json) : {},
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}
