/**
 * NW-103 — enhanced mentions: @here, @channel, role groups, member autocomplete.
 */

const SPECIAL_MENTIONS = [
  { id: "here", label: "@here", description: "Notify members active in this room", kind: "special" },
  { id: "channel", label: "@channel", description: "Notify everyone in this room", kind: "special" },
  { id: "role:owner", label: "@role:owner", description: "Notify room owners", kind: "role" },
  { id: "role:admin", label: "@role:admin", description: "Notify room admins", kind: "role" },
  { id: "role:moderator", label: "@role:moderator", description: "Notify room moderators", kind: "role" },
  { id: "role:member", label: "@role:member", description: "Notify all members", kind: "role" },
];

const ROLE_ALIASES = {
  owners: "owner",
  owner: "owner",
  admins: "admin",
  admin: "admin",
  moderators: "moderator",
  moderator: "moderator",
  members: "member",
  member: "member",
};

/**
 * @param {string} token
 */
export function normalizeMentionToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower === "here" || lower === "channel") return lower;
  if (lower.startsWith("role:")) {
    const role = lower.slice(5);
    return ROLE_ALIASES[role] ? `role:${ROLE_ALIASES[role]}` : lower;
  }
  if (ROLE_ALIASES[lower]) return `role:${ROLE_ALIASES[lower]}`;
  return raw;
}

/**
 * Agent invoke looks up bots by handle (`@assistant`), not room member user ids.
 * `expandMentions` drops those handles, so callers must keep the raw tokens.
 */
export function mentionHandlesForAgentInvoke(tokens) {
  const handles = [];
  for (const raw of tokens || []) {
    const token = normalizeMentionToken(raw);
    if (!token) continue;
    if (token === "here" || token === "channel" || token.startsWith("role:")) continue;
    handles.push(token.replace(/^@/, ""));
  }
  return [...new Set(handles)];
}

/**
 * @param {*} env
 * @param {string} roomId
 */
async function listRoomMemberRows(env, roomId) {
  const rows = await env.DB.prepare(
    `SELECT user_id, role FROM room_members WHERE room_id = ? ORDER BY joined_at ASC`,
  )
    .bind(roomId)
    .all();
  return rows.results || [];
}

/**
 * @param {Array<{ user_id: string, role: string }>} members
 * @param {string} role
 */
function filterMembersByRole(members, role) {
  if (role === "owner") return members.filter((m) => m.role === "owner");
  if (role === "admin") return members.filter((m) => ["owner", "admin"].includes(m.role));
  if (role === "moderator") {
    return members.filter((m) => ["owner", "admin", "moderator"].includes(m.role));
  }
  return members;
}

/**
 * Expand @here / @channel / @role:* tokens to concrete user IDs.
 *
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   authorUserId: string,
 *   tokens: string[],
 *   onlineUserIds?: string[],
 * }} input
 */
export async function expandMentions(env, input) {
  const members = await listRoomMemberRows(env, input.roomId);
  const memberIds = new Set(members.map((m) => m.user_id));
  const online = new Set(
    (input.onlineUserIds || []).filter((id) => id && memberIds.has(id)),
  );
  const resolved = new Set();

  for (const raw of input.tokens || []) {
    const token = normalizeMentionToken(raw);
    if (!token) continue;

    if (token === "here") {
      const targets = online.size ? [...online] : members.map((m) => m.user_id);
      for (const uid of targets) {
        if (uid !== input.authorUserId) resolved.add(uid);
      }
      continue;
    }

    if (token === "channel") {
      for (const m of members) {
        if (m.user_id !== input.authorUserId) resolved.add(m.user_id);
      }
      continue;
    }

    if (token.startsWith("role:")) {
      const role = token.slice(5);
      for (const m of filterMembersByRole(members, role)) {
        if (m.user_id !== input.authorUserId) resolved.add(m.user_id);
      }
      continue;
    }

    if (memberIds.has(token) && token !== input.authorUserId) {
      resolved.add(token);
    }
  }

  return [...resolved];
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, query?: string, limit?: number }} input
 */
export async function listMentionSuggestions(env, input) {
  const q = String(input.query || "").trim().toLowerCase();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const members = await listRoomMemberRows(env, input.roomId);

  const specials = SPECIAL_MENTIONS.filter((s) => {
    if (!q) return true;
    return (
      s.id.includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  });

  const users = members
    .filter((m) => {
      if (!q) return true;
      return m.user_id.toLowerCase().includes(q) || String(m.role || "").toLowerCase().includes(q);
    })
    .map((m) => ({
      id: m.user_id,
      label: `@${m.user_id}`,
      description: `Room ${m.role || "member"}`,
      kind: "user",
      role: m.role,
    }));

  return [...specials, ...users].slice(0, limit);
}

export { SPECIAL_MENTIONS };
