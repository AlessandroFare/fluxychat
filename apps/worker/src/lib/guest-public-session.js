/**
 * Mint ephemeral guest JWT for any public room (Sendbird open channel, P10-SB6).
 */
import { isPublicRoomInProject } from "./public-room-access.js";
import { isPublicGuestEnabled } from "./guest-auth.js";
import { guardPublicGuestRequest } from "./public-guest-guard.js";
import { getEmbedConfigForProject } from "./embed-config.js";

/**
 * @param {*} env
 * @param {{
 *   resolveProjectId?: never,
 *   signJwtHs256: (secret: string, payload: object) => Promise<string>,
 *   isValidId: (id: string) => boolean,
 * }} deps
 * @param {{ roomId: string, displayName?: string, userId?: string }} input
 * @param {Request} [request]
 */
export async function issuePublicGuestSession(env, deps, input, request) {
  const { signJwtHs256, isValidId } = deps;

  if (!isPublicGuestEnabled(env)) {
    return { ok: false, status: 404, body: { enabled: false, error: "public_guest_disabled" } };
  }

  const roomId = String(input.roomId || "").trim();
  if (!roomId || !isValidId(roomId)) {
    return { ok: false, status: 400, body: { error: "invalid roomId" } };
  }

  const roomRow = await env.DB.prepare(
    "SELECT id, project_id, type FROM rooms WHERE id = ? LIMIT 1",
  )
    .bind(roomId)
    .first();

  if (!roomRow) {
    return { ok: false, status: 404, body: { error: "room_not_found" } };
  }

  const projectId = roomRow.project_id;

  if (request) {
    const embedConfig = await getEmbedConfigForProject(env, projectId);
    const guard = await guardPublicGuestRequest(env, request, {
      turnstileToken: input.turnstileToken,
      projectId,
      embedConfig,
      embedParentOrigin: input.embedParentOrigin,
    });
    if (!guard.ok) {
      return {
        ok: false,
        status: guard.status,
        body: {
          error: guard.error,
          retryAfterSeconds: guard.retryAfterSeconds,
        },
      };
    }
  }
  const isPublic = await isPublicRoomInProject(env.DB, projectId, roomId);
  if (!isPublic) {
    return { ok: false, status: 403, body: { error: "room_not_public" } };
  }

  let guestUserId =
    typeof input.userId === "string" && input.userId.trim()
      ? input.userId.trim()
      : `guest_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  if (!isValidId(guestUserId)) {
    guestUserId = `guest_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'guest', ?)",
  )
    .bind(roomId, guestUserId, now)
    .run();

  const secretRow = await env.DB.prepare(
    "SELECT jwt_secret FROM project_secrets WHERE project_id = ?",
  )
    .bind(projectId)
    .first();

  if (!secretRow?.jwt_secret) {
    return { ok: false, status: 500, body: { error: "project_secret_missing" } };
  }

  const ttlSeconds = Math.min(
    7200,
    Math.max(300, Number(env.PUBLIC_GUEST_TOKEN_TTL_SECONDS || 3600)),
  );

  const token = await signJwtHs256(secretRow.jwt_secret, {
    sub: guestUserId,
    tid: projectId,
    roles: ["guest"],
    roomId,
    ...(input.displayName ? { name: String(input.displayName).slice(0, 64) } : {}),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });

  return {
    ok: true,
    status: 200,
    body: {
      enabled: true,
      roomId,
      projectId,
      userId: guestUserId,
      token,
      expiresIn: ttlSeconds,
      roles: ["guest"],
      readOnly: env.PUBLIC_GUEST_READ_ONLY !== "false" && env.PUBLIC_GUEST_READ_ONLY !== "0",
    },
  };
}
