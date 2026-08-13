/**
 * CP-018: User contact / friend list.
 * NW-132: Friend request flow + group ownership transfer.
 */

export async function listContacts(env, { projectId, ownerUserId, status = "accepted" }) {
  const rows = await env.DB.prepare(
    `SELECT contact_user_id, display_name, status, created_at, updated_at
     FROM user_contacts WHERE project_id = ? AND owner_user_id = ? AND status = ?
     ORDER BY display_name ASC, contact_user_id ASC`,
  )
    .bind(projectId, ownerUserId, status)
    .all();
  return (rows.results || []).map((r) => ({
    userId: r.contact_user_id,
    displayName: r.display_name || r.contact_user_id,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function addContact(env, { projectId, ownerUserId, contactUserId, displayName }) {
  if (!contactUserId || ownerUserId === contactUserId) {
    return { ok: false, error: "invalid_contact" };
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_contacts (project_id, owner_user_id, contact_user_id, display_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'accepted', ?, ?)
     ON CONFLICT(project_id, owner_user_id, contact_user_id) DO UPDATE SET
       display_name = COALESCE(excluded.display_name, user_contacts.display_name),
       status = 'accepted',
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, ownerUserId, contactUserId, displayName || null, now, now)
    .run();
  return { ok: true };
}

export async function removeContact(env, projectId, ownerUserId, contactUserId) {
  await env.DB.prepare(
    `DELETE FROM user_contacts WHERE project_id = ? AND owner_user_id = ? AND contact_user_id = ?`,
  )
    .bind(projectId, ownerUserId, contactUserId)
    .run();
  return { ok: true };
}

/** NW-132 — Send a friend request (pending until accepted). */
export async function requestContact(env, { projectId, ownerUserId, contactUserId, displayName }) {
  if (!contactUserId || ownerUserId === contactUserId) {
    return { ok: false, error: "invalid_contact" };
  }
  const existing = await env.DB.prepare(
    `SELECT status FROM user_contacts
     WHERE project_id = ? AND owner_user_id = ? AND contact_user_id = ? LIMIT 1`,
  )
    .bind(projectId, ownerUserId, contactUserId)
    .first();
  if (existing?.status === "accepted") {
    return { ok: false, error: "already_contacts" };
  }
  if (existing?.status === "pending") {
    return { ok: false, error: "request_already_pending" };
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_contacts (project_id, owner_user_id, contact_user_id, display_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(projectId, ownerUserId, contactUserId, displayName || null, now, now)
    .run();
  return { ok: true, status: "pending" };
}

/** Incoming friend requests where contact_user_id is the current user. */
export async function listIncomingContactRequests(env, { projectId, userId }) {
  const rows = await env.DB.prepare(
    `SELECT owner_user_id, contact_user_id, display_name, status, created_at, updated_at
     FROM user_contacts
     WHERE project_id = ? AND contact_user_id = ? AND status = 'pending'
     ORDER BY created_at DESC`,
  )
    .bind(projectId, userId)
    .all();
  return (rows.results || []).map((r) => ({
    fromUserId: r.owner_user_id,
    displayName: r.display_name || r.owner_user_id,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** NW-132 — Accept a pending friend request. */
export async function acceptContactRequest(env, { projectId, ownerUserId, fromUserId }) {
  const pending = await env.DB.prepare(
    `SELECT owner_user_id FROM user_contacts
     WHERE project_id = ? AND owner_user_id = ? AND contact_user_id = ? AND status = 'pending' LIMIT 1`,
  )
    .bind(projectId, fromUserId, ownerUserId)
    .first();
  if (!pending) return { ok: false, error: "request_not_found" };

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE user_contacts SET status = 'accepted', updated_at = ? WHERE project_id = ? AND owner_user_id = ? AND contact_user_id = ?`,
  )
    .bind(now, projectId, fromUserId, ownerUserId)
    .run();

  await env.DB.prepare(
    `INSERT INTO user_contacts (project_id, owner_user_id, contact_user_id, status, created_at, updated_at)
     VALUES (?, ?, ?, 'accepted', ?, ?)
     ON CONFLICT(project_id, owner_user_id, contact_user_id) DO UPDATE SET
       status = 'accepted',
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, ownerUserId, fromUserId, now, now)
    .run();

  return { ok: true, status: "accepted" };
}

export async function declineContactRequest(env, { projectId, ownerUserId, fromUserId }) {
  const result = await env.DB.prepare(
    `DELETE FROM user_contacts
     WHERE project_id = ? AND owner_user_id = ? AND contact_user_id = ? AND status = 'pending'`,
  )
    .bind(projectId, fromUserId, ownerUserId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "request_not_found" };
  return { ok: true };
}

/**
 * NW-132 — Transfer group room ownership to another member.
 */
export async function transferGroupOwnership(env, {
  projectId,
  roomId,
  fromUserId,
  toUserId,
  jwtRoles = [],
}) {
  if (!toUserId || fromUserId === toUserId) {
    return { ok: false, error: "invalid_target" };
  }

  const room = await env.DB.prepare(
    `SELECT type FROM rooms WHERE project_id = ? AND id = ? LIMIT 1`,
  )
    .bind(projectId, roomId)
    .first();
  if (!room) return { ok: false, error: "room_not_found" };
  if (room.type !== "group" && room.type !== "announcement") {
    return { ok: false, error: "ownership_transfer_group_only" };
  }

  const fromMember = await env.DB.prepare(
    `SELECT role FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(roomId, fromUserId)
    .first();
  const isOwner =
    fromMember?.role === "owner" ||
    (Array.isArray(jwtRoles) && jwtRoles.includes("owner"));
  if (!isOwner) return { ok: false, error: "forbidden" };

  const target = await env.DB.prepare(
    `SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(roomId, toUserId)
    .first();
  if (!target) return { ok: false, error: "target_not_member" };

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE room_members SET role = 'admin' WHERE room_id = ? AND user_id = ?`).bind(
      roomId,
      fromUserId,
    ),
    env.DB.prepare(`UPDATE room_members SET role = 'owner' WHERE room_id = ? AND user_id = ?`).bind(
      roomId,
      toUserId,
    ),
  ]);

  return { ok: true, roomId, fromUserId, toUserId, transferredAt: now };
}
