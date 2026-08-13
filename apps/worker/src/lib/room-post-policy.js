/**
 * NW-131 — Room post policy (announcement channels = admin-only post).
 */
import { getRoomMemberRole } from "./message-decisions.js";

const ANNOUNCEMENT_POST_ROLES = new Set(["owner", "admin", "moderator"]);

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   jwtRoles?: string[],
 * }} input
 */
export async function assertCanPostToRoom(env, input) {
  const row = await env.DB.prepare(
    `SELECT type FROM rooms WHERE project_id = ? AND id = ? LIMIT 1`,
  )
    .bind(input.projectId, input.roomId)
    .first();

  if (!row) {
    return { ok: false, error: "room_not_found", status: 404 };
  }

  if (String(row.type) !== "announcement") {
    return { ok: true, roomType: row.type };
  }

  const role = await getRoomMemberRole(
    env,
    input.roomId,
    input.userId,
    input.jwtRoles ?? [],
  );

  if (ANNOUNCEMENT_POST_ROLES.has(role)) {
    return { ok: true, roomType: "announcement", role };
  }

  return {
    ok: false,
    error: "announcement_read_only",
    status: 403,
    roomType: "announcement",
    role,
  };
}

export { ANNOUNCEMENT_POST_ROLES };
