/**
 * Custom user groups (Mattermost-style) — named member sets.
 * Mentionable as `@group:<name>`; expansion intersects the group with room members.
 */

export const USER_GROUP_NAME_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;
const MAX_GROUP_MEMBERS = 200;
const MAX_GROUPS = 200;

export function normalizeUserGroupName(name) {
  return String(name || "").trim().toLowerCase();
}

export function isValidUserGroupName(name) {
  return USER_GROUP_NAME_RE.test(String(name || ""));
}

function uniqueIds(ids) {
  return [
    ...new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];
}

export async function createUserGroup(env, { projectId, name, memberIds = [] }) {
  if (!projectId) return { ok: false, error: "invalid_project" };
  const normalized = normalizeUserGroupName(name);
  if (!isValidUserGroupName(normalized)) {
    return { ok: false, error: "invalid_group_name" };
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM user_groups WHERE project_id = ? AND name = ? LIMIT 1",
  )
    .bind(projectId, normalized)
    .first();
  if (existing) return { ok: false, error: "group_exists", status: 409 };
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM user_groups WHERE project_id = ?",
  )
    .bind(projectId)
    .first();
  if (Number(count?.c || 0) >= MAX_GROUPS) {
    return { ok: false, error: "group_limit" };
  }
  const members = uniqueIds(memberIds).slice(0, MAX_GROUP_MEMBERS);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO user_groups (id, project_id, name, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, projectId, normalized, now)
    .run();
  if (members.length) {
    await env.DB.batch(
      members.map((userId) =>
        env.DB.prepare(
          "INSERT OR IGNORE INTO user_group_members (group_id, project_id, user_id, created_at) VALUES (?, ?, ?, ?)",
        ).bind(id, projectId, userId, now),
      ),
    );
  }
  return { ok: true, group: { id, name: normalized, memberIds: members, createdAt: now } };
}

export async function listUserGroups(env, { projectId }) {
  if (!projectId) return { groups: [] };
  const groups = await env.DB.prepare(
    "SELECT id, name, created_at FROM user_groups WHERE project_id = ? ORDER BY name ASC LIMIT ?",
  )
    .bind(projectId, MAX_GROUPS)
    .all();
  const rows = groups.results || [];
  if (!rows.length) return { groups: [] };
  const members = await env.DB.prepare(
    "SELECT group_id, user_id FROM user_group_members WHERE project_id = ? ORDER BY created_at ASC",
  )
    .bind(projectId)
    .all();
  const byGroup = new Map();
  for (const row of members.results || []) {
    if (!byGroup.has(row.group_id)) byGroup.set(row.group_id, []);
    byGroup.get(row.group_id).push(row.user_id);
  }
  return {
    groups: rows.map((group) => ({
      id: group.id,
      name: group.name,
      createdAt: group.created_at,
      memberIds: byGroup.get(group.id) || [],
    })),
  };
}

export async function deleteUserGroup(env, { projectId, groupId }) {
  if (!projectId || !groupId) return { ok: false, error: "invalid_group" };
  const existing = await env.DB.prepare(
    "SELECT id FROM user_groups WHERE id = ? AND project_id = ? LIMIT 1",
  )
    .bind(groupId, projectId)
    .first();
  if (!existing) return { ok: false, error: "group_not_found", status: 404 };
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM user_group_members WHERE group_id = ? AND project_id = ?",
    ).bind(groupId, projectId),
    env.DB.prepare("DELETE FROM user_groups WHERE id = ? AND project_id = ?").bind(
      groupId,
      projectId,
    ),
  ]);
  return { ok: true };
}

export async function addUserGroupMembers(env, { projectId, groupId, userIds = [] }) {
  if (!projectId || !groupId) return { ok: false, error: "invalid_group" };
  const existing = await env.DB.prepare(
    "SELECT id FROM user_groups WHERE id = ? AND project_id = ? LIMIT 1",
  )
    .bind(groupId, projectId)
    .first();
  if (!existing) return { ok: false, error: "group_not_found", status: 404 };
  const members = uniqueIds(userIds).slice(0, MAX_GROUP_MEMBERS);
  if (!members.length) return { ok: false, error: "user_ids_required" };
  const now = new Date().toISOString();
  await env.DB.batch(
    members.map((userId) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO user_group_members (group_id, project_id, user_id, created_at) VALUES (?, ?, ?, ?)",
      ).bind(groupId, projectId, userId, now),
    ),
  );
  return { ok: true, added: members.length };
}

export async function removeUserGroupMember(env, { projectId, groupId, userId }) {
  if (!projectId || !groupId || !userId) {
    return { ok: false, error: "invalid_group_member" };
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM user_groups WHERE id = ? AND project_id = ? LIMIT 1",
  )
    .bind(groupId, projectId)
    .first();
  if (!existing) return { ok: false, error: "group_not_found", status: 404 };
  await env.DB.prepare(
    "DELETE FROM user_group_members WHERE group_id = ? AND project_id = ? AND user_id = ?",
  )
    .bind(groupId, projectId, userId)
    .run();
  return { ok: true };
}

export async function getUserGroupMemberIds(env, { projectId, name }) {
  const normalized = normalizeUserGroupName(name);
  if (!projectId || !normalized) return [];
  const group = await env.DB.prepare(
    "SELECT id FROM user_groups WHERE project_id = ? AND name = ? LIMIT 1",
  )
    .bind(projectId, normalized)
    .first();
  if (!group) return [];
  const rows = await env.DB.prepare(
    "SELECT user_id FROM user_group_members WHERE group_id = ? AND project_id = ?",
  )
    .bind(group.id, projectId)
    .all();
  return (rows.results || []).map((row) => row.user_id);
}

export async function listUserGroupNames(env, { projectId }) {
  if (!projectId) return [];
  const rows = await env.DB.prepare(
    "SELECT name FROM user_groups WHERE project_id = ? ORDER BY name ASC LIMIT 100",
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map((row) => row.name);
}
