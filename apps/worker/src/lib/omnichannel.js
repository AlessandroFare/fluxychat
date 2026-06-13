/**
 * P17-D: Unified Omnichannel Inbox
 * Channel abstraction layer, unified view, and routing rules.
 */

const VALID_CHANNEL_TYPES = ["chat", "email", "sms", "whatsapp", "telegram", "slack", "discord", "webhook", "custom"];

/**
 * @param {*} roles
 */
export function canManageChannels(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => ["owner", "admin"].includes(r));
}

/**
 * @param {*} roles
 */
export function canViewInbox(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => ["owner", "admin", "moderator", "member"].includes(r));
}

/* ── Channel Config CRUD ── */

export async function listChannelConfigs(db, { projectId }) {
  const { results } = await db
    .prepare(`SELECT * FROM channel_configs WHERE project_id = ? ORDER BY created_at DESC`)
    .bind(projectId)
    .all();
  return (results || []).map(mapChannelConfig);
}

export async function getChannelConfig(db, { projectId, configId }) {
  const row = await db
    .prepare(`SELECT * FROM channel_configs WHERE id = ? AND project_id = ?`)
    .bind(configId, projectId)
    .first();
  return row ? mapChannelConfig(row) : null;
}

export async function createChannelConfig(db, { projectId, channelType, channelName, settings }) {
  if (!VALID_CHANNEL_TYPES.includes(channelType)) {
    return { ok: false, error: "invalid_channel_type" };
  }
  if (!channelName || !channelName.trim()) {
    return { ok: false, error: "channel_name_required" };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO channel_configs (id, project_id, channel_type, channel_name, enabled, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
    )
    .bind(id, projectId, channelType, channelName.trim(), settings ? JSON.stringify(settings) : null, now, now)
    .run();

  return { ok: true, id, channelType, channelName: channelName.trim() };
}

export async function updateChannelConfig(db, { projectId, configId, channelName, enabled, settings }) {
  const sets = [];
  const params = [];

  if (channelName !== undefined) {
    if (!channelName || !channelName.trim()) return { ok: false, error: "channel_name_required" };
    sets.push("channel_name = ?");
    params.push(channelName.trim());
  }
  if (enabled !== undefined) {
    sets.push("enabled = ?");
    params.push(enabled ? 1 : 0);
  }
  if (settings !== undefined) {
    sets.push("settings = ?");
    params.push(settings ? JSON.stringify(settings) : null);
  }

  if (sets.length === 0) return { ok: true };

  sets.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(configId);
  params.push(projectId);

  const result = await db
    .prepare(`UPDATE channel_configs SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`)
    .bind(...params)
    .run();

  return { ok: true, changed: (result.meta?.changes || 0) > 0 };
}

export async function deleteChannelConfig(db, { projectId, configId }) {
  await db
    .prepare(`DELETE FROM channel_routing_rules WHERE channel_config_id = ? AND project_id = ?`)
    .bind(configId, projectId)
    .run();

  const result = await db
    .prepare(`DELETE FROM channel_configs WHERE id = ? AND project_id = ?`)
    .bind(configId, projectId)
    .run();

  return { ok: true, deleted: (result.meta?.changes || 0) > 0 };
}

/* ── Routing Rules CRUD ── */

export async function listRoutingRules(db, { projectId, channelConfigId }) {
  const { results } = await channelConfigId
    ? await db
        .prepare(`SELECT * FROM channel_routing_rules WHERE project_id = ? AND channel_config_id = ? ORDER BY priority DESC`)
        .bind(projectId, channelConfigId)
        .all()
    : await db
        .prepare(`SELECT * FROM channel_routing_rules WHERE project_id = ? ORDER BY priority DESC`)
        .bind(projectId)
        .all();
  return (results || []).map(mapRoutingRule);
}

export async function createRoutingRule(db, { projectId, channelConfigId, ruleName, matchPattern, targetRoomId, targetRoomPattern, priority }) {
  if (!ruleName || !ruleName.trim()) return { ok: false, error: "rule_name_required" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO channel_routing_rules (id, project_id, channel_config_id, rule_name, match_pattern, target_room_id, target_room_pattern, priority, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(id, projectId, channelConfigId, ruleName.trim(), matchPattern ?? null, targetRoomId ?? null, targetRoomPattern ?? null, priority ?? 0, now, now)
    .run();

  return { ok: true, id };
}

export async function updateRoutingRule(db, { projectId, ruleId, ruleName, matchPattern, targetRoomId, targetRoomPattern, priority, enabled }) {
  const sets = [];
  const params = [];

  if (ruleName !== undefined) { sets.push("rule_name = ?"); params.push(ruleName.trim()); }
  if (matchPattern !== undefined) { sets.push("match_pattern = ?"); params.push(matchPattern); }
  if (targetRoomId !== undefined) { sets.push("target_room_id = ?"); params.push(targetRoomId); }
  if (targetRoomPattern !== undefined) { sets.push("target_room_pattern = ?"); params.push(targetRoomPattern); }
  if (priority !== undefined) { sets.push("priority = ?"); params.push(priority); }
  if (enabled !== undefined) { sets.push("enabled = ?"); params.push(enabled ? 1 : 0); }

  if (sets.length === 0) return { ok: true };

  sets.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(ruleId);
  params.push(projectId);

  const result = await db
    .prepare(`UPDATE channel_routing_rules SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`)
    .bind(...params)
    .run();

  return { ok: true, changed: (result.meta?.changes || 0) > 0 };
}

export async function deleteRoutingRule(db, { projectId, ruleId }) {
  const result = await db
    .prepare(`DELETE FROM channel_routing_rules WHERE id = ? AND project_id = ?`)
    .bind(ruleId, projectId)
    .run();
  return { ok: true, deleted: (result.meta?.changes || 0) > 0 };
}

/* ── Routing Resolution ── */

/**
 * Find the best routing rule for an incoming channel message.
 * Returns the target room_id or null.
 */
export async function resolveRouting(db, { projectId, channelType, senderId, subject, body }) {
  const { results: rules } = await db
    .prepare(
      `SELECT rr.*, cc.channel_type FROM channel_routing_rules rr
       INNER JOIN channel_configs cc ON cc.id = rr.channel_config_id
       WHERE rr.project_id = ? AND cc.enabled = 1 AND rr.enabled = 1 AND cc.channel_type = ?
       ORDER BY rr.priority DESC`,
    )
    .bind(projectId, channelType)
    .all();

  for (const rule of rules || []) {
    if (rule.match_pattern && !matchPattern(rule.match_pattern, { senderId, subject, body })) {
      continue;
    }
    if (rule.target_room_id) return { roomId: rule.target_room_id, ruleId: rule.id };
    if (rule.target_room_pattern) {
      const roomId = resolveRoomPattern(rule.target_room_pattern, { senderId, subject, body });
      if (roomId) return { roomId, ruleId: rule.id };
    }
  }

  return { roomId: null, ruleId: null };
}

/* ── Thread Linking ── */

export async function linkThread(db, { projectId, roomId, channelType, externalThreadId, externalUserId, externalUserName }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO channel_thread_links (id, project_id, room_id, channel_type, external_thread_id, external_user_id, external_user_name, linked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, room_id, channel_type, external_thread_id) DO UPDATE SET
         external_user_id = excluded.external_user_id,
         external_user_name = excluded.external_user_name`,
    )
    .bind(id, projectId, roomId, channelType, externalThreadId, externalUserId ?? null, externalUserName ?? null, now)
    .run();

  return { ok: true, id };
}

export async function getThreadLinks(db, { projectId, roomId }) {
  const { results } = await db
    .prepare(`SELECT * FROM channel_thread_links WHERE project_id = ? AND room_id = ?`)
    .bind(projectId, roomId)
    .all();
  return (results || []).map(mapThreadLink);
}

export async function getRoomByExternalThread(db, { projectId, channelType, externalThreadId }) {
  const row = await db
    .prepare(`SELECT room_id FROM channel_thread_links WHERE project_id = ? AND channel_type = ? AND external_thread_id = ?`)
    .bind(projectId, channelType, externalThreadId)
    .first();
  return row?.room_id ?? null;
}

/* ── Unified Inbox ── */

/**
 * Get a unified cross-channel inbox view.
 * Returns recent conversations across all channels, grouped by room.
 */
export async function getUnifiedInbox(db, { projectId, userId, limit = 50 }) {
  const { results: rooms } = await db
    .prepare(
      `SELECT DISTINCT r.id, r.name, r.type, r.created_at
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       WHERE r.project_id = ? AND (rm.user_id = ? OR r.type = 'dm')
       ORDER BY r.created_at DESC LIMIT ?`,
    )
    .bind(projectId, userId, limit)
    .all();

  const entries = [];
  for (const room of rooms || []) {
    const links = await getThreadLinks(db, { projectId, roomId: room.id });
    const channels = links.map((l) => l.channelType);
    const lastMsg = await db
      .prepare(
        `SELECT id, user_id, content, kind, created_at FROM messages
         WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
         ORDER BY id DESC LIMIT 1`,
      )
      .bind(projectId, room.id)
      .first();

    entries.push({
      roomId: room.id,
      roomName: room.name || room.id,
      roomType: room.type,
      channels: [...new Set(channels)],
      threadCount: links.length,
      lastMessage: lastMsg
        ? { messageId: lastMsg.id, userId: lastMsg.user_id, content: String(lastMsg.content || "").slice(0, 120), kind: lastMsg.kind, createdAt: lastMsg.created_at }
        : null,
    });
  }

  entries.sort((a, b) => {
    const ta = a.lastMessage?.createdAt || "";
    const tb = b.lastMessage?.createdAt || "";
    return tb.localeCompare(ta);
  });

  return entries;
}

/* ── Helpers ── */

function mapChannelConfig(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    channelType: row.channel_type,
    channelName: row.channel_name,
    enabled: Boolean(row.enabled),
    settings: row.settings ? safeParseJson(row.settings) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoutingRule(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    channelConfigId: row.channel_config_id,
    ruleName: row.rule_name,
    matchPattern: row.match_pattern,
    targetRoomId: row.target_room_id,
    targetRoomPattern: row.target_room_pattern,
    priority: row.priority,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapThreadLink(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    channelType: row.channel_type,
    externalThreadId: row.external_thread_id,
    externalUserId: row.external_user_id,
    externalUserName: row.external_user_name,
    linkedAt: row.linked_at,
  };
}

function matchPattern(pattern, { senderId, subject, body }) {
  try {
    const re = new RegExp(pattern, "i");
    return re.test(senderId || "") || re.test(subject || "") || re.test(body || "");
  } catch {
    return false;
  }
}

function resolveRoomPattern(pattern, { senderId, subject, body }) {
  try {
    return pattern.replace(/\{senderId\}/g, senderId || "").replace(/\{subject\}/g, subject || "").replace(/\{body\}/g, (body || "").slice(0, 50));
  } catch {
    return null;
  }
}

function safeParseJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}
