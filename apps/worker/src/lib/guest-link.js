/**
 * Guest → account linking (nakama borrow, P10-SB6 follow-up).
 *
 * A signed-in account claims a guest identity by presenting its JWT: room
 * memberships move to the target (role `guest` upgrades to `member`) and the
 * claim is recorded in `guest_links` so the guest cannot be claimed twice.
 *
 * Boundary: membership only. Message authorship, reactions, and read markers
 * stay under the guest user id — history attribution is not rewritten.
 */

import { isGuestOnlyAuth } from "./guest-auth.js";

/**
 * @param {*} env
 * @param {{
 *   verifyJwtAndGetContext: (request: Request, env: *, opts?: object) => Promise<*>,
 * }} deps
 * @param {{
 *   projectId: string,
 *   targetUserId: string,
 *   targetRoles?: string[],
 *   guestToken?: string,
 * }} input
 * @returns {Promise<{ ok: boolean, status: number, body: object }>}
 */
export async function linkGuestToAccount(env, deps, input) {
  const { projectId, targetUserId, targetRoles, guestToken } = input ?? {};

  if (!projectId || !targetUserId) {
    return { ok: false, status: 401, body: { error: "unauthorized" } };
  }
  if (typeof guestToken !== "string" || !guestToken.trim()) {
    return { ok: false, status: 400, body: { error: "guest_token_required" } };
  }
  if (isGuestOnlyAuth({ roles: targetRoles })) {
    return { ok: false, status: 400, body: { error: "target_is_guest" } };
  }

  // The guest token is the proof of ownership: verified against the same
  // project secret as the caller (expectedProjectId), then required to be
  // guest-only so a member token cannot be claimed as a guest identity.
  const guestRequest = new Request("https://internal/tokens/link-guest", {
    headers: { Authorization: `Bearer ${guestToken.trim()}` },
  });
  const guestAuth = await deps
    .verifyJwtAndGetContext(guestRequest, env, { expectedProjectId: projectId })
    .catch(() => null);
  if (!guestAuth?.userId || !isGuestOnlyAuth(guestAuth)) {
    return { ok: false, status: 400, body: { error: "invalid_guest_token" } };
  }
  const guestUserId = guestAuth.userId;
  if (guestUserId === targetUserId) {
    return { ok: false, status: 400, body: { error: "same_user" } };
  }

  const linked = await env.DB.prepare(
    "SELECT target_user_id FROM guest_links WHERE project_id = ? AND guest_user_id = ? LIMIT 1",
  )
    .bind(projectId, guestUserId)
    .first();
  if (linked) {
    return {
      ok: false,
      status: 409,
      body: { error: "guest_already_linked", targetUserId: linked.target_user_id },
    };
  }

  const guestRooms =
    (
      await env.DB.prepare(
        "SELECT rm.room_id, rm.role FROM room_members rm JOIN rooms r ON r.id = rm.room_id WHERE rm.user_id = ? AND r.project_id = ?",
      )
        .bind(guestUserId, projectId)
        .all()
    ).results ?? [];
  const targetRooms = new Set(
    (
      (
        await env.DB.prepare(
          "SELECT rm.room_id FROM room_members rm JOIN rooms r ON r.id = rm.room_id WHERE rm.user_id = ? AND r.project_id = ?",
        )
          .bind(targetUserId, projectId)
          .all()
      ).results ?? []
    ).map((row) => row.room_id),
  );

  const toTransfer = guestRooms.filter((row) => !targetRooms.has(row.room_id));
  const alreadyMember = guestRooms.filter((row) => targetRooms.has(row.room_id));

  const statements = [];
  if (toTransfer.length > 0) {
    const placeholders = toTransfer.map(() => "?").join(", ");
    statements.push(
      env.DB.prepare(
        `UPDATE room_members SET user_id = ?, role = CASE WHEN role = 'guest' THEN 'member' ELSE role END WHERE user_id = ? AND room_id IN (${placeholders})`,
      ).bind(targetUserId, guestUserId, ...toTransfer.map((row) => row.room_id)),
    );
  }
  if (alreadyMember.length > 0) {
    const placeholders = alreadyMember.map(() => "?").join(", ");
    statements.push(
      env.DB.prepare(
        `DELETE FROM room_members WHERE user_id = ? AND room_id IN (${placeholders})`,
      ).bind(guestUserId, ...alreadyMember.map((row) => row.room_id)),
    );
  }
  statements.push(
    env.DB.prepare(
      "INSERT INTO guest_links (project_id, guest_user_id, target_user_id, linked_at) VALUES (?, ?, ?, ?)",
    ).bind(projectId, guestUserId, targetUserId, new Date().toISOString()),
  );

  try {
    await env.DB.batch(statements);
  } catch {
    // First decision wins: two concurrent claims of the same guest collide on
    // the guest_links primary key (batch is a transaction, so the loser
    // applied nothing). Losers re-read the winner and get the 409.
    const raced = await env.DB.prepare(
      "SELECT target_user_id FROM guest_links WHERE project_id = ? AND guest_user_id = ? LIMIT 1",
    )
      .bind(projectId, guestUserId)
      .first()
      .catch(() => null);
    if (raced) {
      return {
        ok: false,
        status: 409,
        body: { error: "guest_already_linked", targetUserId: raced.target_user_id },
      };
    }
    return { ok: false, status: 500, body: { error: "guest_link_failed" } };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      guestUserId,
      targetUserId,
      roomsTransferred: toTransfer.length,
      roomsAlreadyMember: alreadyMember.length,
    },
  };
}
