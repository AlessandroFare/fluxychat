import { isPublicGuestEnabled, isPublicGuestReadOnly } from "./guest-auth.js";
import { isValidId } from "./valid-ids.js";

function newShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function publicRoomRow(env, roomId) {
  const id = String(roomId || "").trim();
  if (!isValidId(id)) return null;
  const row = await env.DB.prepare(`SELECT id, name, type, project_id FROM rooms WHERE id = ? LIMIT 1`)
    .bind(id)
    .first();
  if (!row || row.type !== "public") return null;
  return row;
}

export async function ensureRoomShareLink(env, roomId) {
  const row = await publicRoomRow(env, roomId);
  if (!row) return { ok: false, error: "not_public", status: 404 };
  const existing = await env.DB.prepare(
    `SELECT token FROM room_share_links WHERE room_id = ? AND revoked_at IS NULL LIMIT 1`,
  )
    .bind(row.id)
    .first()
    .catch(() => null);
  if (existing?.token) {
    return { ok: true, token: existing.token, room: row };
  }
  const token = newShareToken();
  try {
    await env.DB.prepare(
      `INSERT INTO room_share_links (token, room_id, project_id, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(token, row.id, row.project_id, new Date().toISOString())
      .run();
  } catch {
    const raced = await env.DB.prepare(
      `SELECT token FROM room_share_links WHERE room_id = ? AND revoked_at IS NULL LIMIT 1`,
    )
      .bind(row.id)
      .first();
    if (raced?.token) return { ok: true, token: raced.token, room: row };
    return { ok: false, error: "share_token_failed", status: 500 };
  }
  return { ok: true, token, room: row };
}

export async function revokeRoomShareLink(env, roomId) {
  const row = await publicRoomRow(env, roomId);
  if (!row) return { ok: false, error: "not_public", status: 404 };
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE room_share_links SET revoked_at = ? WHERE room_id = ? AND revoked_at IS NULL`,
  )
    .bind(now, row.id)
    .run()
    .catch(() => {});
  const minted = await ensureRoomShareLink(env, roomId);
  return minted;
}

export async function getPublicShareMetaByToken(env, tokenRaw) {
  const token = String(tokenRaw || "").trim();
  if (!/^[a-f0-9]{48}$/i.test(token)) {
    return { ok: false, error: "not_public", status: 404 };
  }
  const link = await env.DB.prepare(
    `SELECT token, room_id FROM room_share_links WHERE token = ? AND revoked_at IS NULL LIMIT 1`,
  )
    .bind(token)
    .first()
    .catch(() => null);
  if (!link?.room_id) return { ok: false, error: "not_public", status: 404 };
  return getPublicShareMetaForRoom(env, link.room_id, token);
}

/**
 * Member metadata. Mints an unguessable token. Room id is not the public path.
 */
export async function getPublicShareMetaForRoom(env, roomId, knownToken) {
  const minted = knownToken
    ? { ok: true, token: knownToken, room: await publicRoomRow(env, roomId) }
    : await ensureRoomShareLink(env, roomId);
  if (!minted.ok || !minted.room) {
    return minted.ok === false ? minted : { ok: false, error: "not_public", status: 404 };
  }
  const row = minted.room;
  if (row.type && row.type !== "public") {
    return { ok: false, error: "not_public", status: 404 };
  }
  return {
    ok: true,
    status: 200,
    roomId: row.id,
    name: row.name || row.id,
    shareToken: minted.token,
    guestEnabled: isPublicGuestEnabled(env),
    guestReadOnly: isPublicGuestReadOnly(env),
    path: `/share/${minted.token}`,
  };
}

/** @deprecated use getPublicShareMetaForRoom / getPublicShareMetaByToken */
export async function getPublicShareMeta(env, roomId) {
  return getPublicShareMetaForRoom(env, roomId);
}

export async function assertShareTokenForRoom(env, roomId, shareToken) {
  const token = String(shareToken || "").trim();
  if (!/^[a-f0-9]{48}$/i.test(token)) return false;
  const link = await env.DB.prepare(
    `SELECT room_id FROM room_share_links WHERE token = ? AND revoked_at IS NULL LIMIT 1`,
  )
    .bind(token)
    .first()
    .catch(() => null);
  return Boolean(link && link.room_id === roomId);
}
