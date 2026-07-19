function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Live Events ---

export async function createEvent(env, { projectId, roomId, title, description, streamUrl, thumbnailUrl, category, tags }) {
  const id = `le_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO live_events (id, project_id, room_id, title, description, status, stream_url, thumbnail_url, category, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, title, description || null, streamUrl || null, thumbnailUrl || null, category || null, tags ? JSON.stringify(tags) : null, now, now).run();
  return { id };
}

export async function updateEvent(env, { projectId, eventId, title, description, status, streamUrl, thumbnailUrl, category, tags }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (title) { sets.push("title = ?"); params.push(title); }
  if (description !== undefined) { sets.push("description = ?"); params.push(description); }
  if (status) {
    sets.push("status = ?"); params.push(status);
    if (status === "live") { sets.push("started_at = ?"); params.push(now); }
    if (status === "ended") { sets.push("ended_at = ?"); params.push(now); }
  }
  if (streamUrl) { sets.push("stream_url = ?"); params.push(streamUrl); }
  if (thumbnailUrl) { sets.push("thumbnail_url = ?"); params.push(thumbnailUrl); }
  if (category !== undefined) { sets.push("category = ?"); params.push(category); }
  if (tags) { sets.push("tags = ?"); params.push(JSON.stringify(tags)); }
  params.push(eventId, projectId);
  await env.DB.prepare(`UPDATE live_events SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`).bind(...params).run();
  return { updated: true };
}

export async function getEvent(env, { eventId, projectId }) {
  const row = await env.DB.prepare("SELECT * FROM live_events WHERE id = ? AND project_id = ?").bind(eventId, projectId).first();
  return row ? mapEventRow(row) : null;
}

export async function listEvents(env, { projectId, status, limit = 25 }) {
  let sql = "SELECT * FROM live_events WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapEventRow);
}

// --- Chat Rules ---

export async function upsertChatRules(env, { eventId, projectId, slowModeSeconds, emoteOnly, subscriberOnly, followerOnly, followerMinutes, linkProtection, maxMessageLength, cooldownSeconds }) {
  const id = `lcr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT id FROM live_chat_rules WHERE event_id = ?").bind(eventId).first();

  if (existing) {
    const sets = ["updated_at = ?"];
    const params = [now];
    if (slowModeSeconds !== undefined) { sets.push("slow_mode_seconds = ?"); params.push(slowModeSeconds); }
    if (emoteOnly !== undefined) { sets.push("emote_only = ?"); params.push(emoteOnly ? 1 : 0); }
    if (subscriberOnly !== undefined) { sets.push("subscriber_only = ?"); params.push(subscriberOnly ? 1 : 0); }
    if (followerOnly !== undefined) { sets.push("follower_only = ?"); params.push(followerOnly ? 1 : 0); }
    if (followerMinutes !== undefined) { sets.push("follower_minutes = ?"); params.push(followerMinutes); }
    if (linkProtection !== undefined) { sets.push("link_protection = ?"); params.push(linkProtection ? 1 : 0); }
    if (maxMessageLength !== undefined) { sets.push("max_message_length = ?"); params.push(maxMessageLength); }
    if (cooldownSeconds !== undefined) { sets.push("cooldown_seconds = ?"); params.push(cooldownSeconds); }
    params.push(existing.id);
    await env.DB.prepare(`UPDATE live_chat_rules SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
    return { id: existing.id, updated: true };
  }

  await env.DB.prepare(
    `INSERT INTO live_chat_rules (id, event_id, project_id, slow_mode_seconds, emote_only, subscriber_only, follower_only, follower_minutes, link_protection, max_message_length, cooldown_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, eventId, projectId, slowModeSeconds || 0, emoteOnly ? 1 : 0, subscriberOnly ? 1 : 0, followerOnly ? 1 : 0, followerMinutes || 0, linkProtection ? 1 : 0, maxMessageLength || 500, cooldownSeconds || 0, now, now).run();
  return { id, created: true };
}

export async function getChatRules(env, { eventId }) {
  const row = await env.DB.prepare("SELECT * FROM live_chat_rules WHERE event_id = ?").bind(eventId).first();
  return row ? mapRulesRow(row) : null;
}

// --- Viewers ---

export async function joinEvent(env, { eventId, projectId, userId, username, role }) {
  const id = `lv_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    "SELECT id FROM live_viewers WHERE event_id = ? AND user_id = ? AND left_at IS NULL"
  ).bind(eventId, userId).first();
  if (existing) return { id: existing.id, alreadyJoined: true };

  await env.DB.prepare(
    `INSERT INTO live_viewers (id, event_id, project_id, user_id, username, role, joined_at, message_count, is_banned, is_muted)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`
  ).bind(id, eventId, projectId, userId, username || null, role || "viewer", now).run();

  await env.DB.prepare(
    "UPDATE live_events SET total_viewers = total_viewers + 1, updated_at = ? WHERE id = ?"
  ).bind(now, eventId).run();

  return { id };
}

export async function leaveEvent(env, { eventId, userId }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE live_viewers SET left_at = ? WHERE event_id = ? AND user_id = ? AND left_at IS NULL"
  ).bind(now, eventId, userId).run();
  return { left: result.meta?.changes || 0 };
}

export async function getViewerCount(env, { eventId }) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_viewers WHERE event_id = ? AND left_at IS NULL"
  ).bind(eventId).first();
  return { count: row?.count || 0 };
}

export async function getPeakViewers(env, { eventId }) {
  const row = await env.DB.prepare(
    "SELECT peak_viewers, total_viewers FROM live_events WHERE id = ?"
  ).bind(eventId).first();
  return { peakViewers: row?.peak_viewers || 0, totalViewers: row?.total_viewers || 0 };
}

export async function updateViewerPeak(env, { eventId }) {
  const now = new Date().toISOString();
  const current = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_viewers WHERE event_id = ? AND left_at IS NULL"
  ).bind(eventId).first();

  await env.DB.prepare(
    "UPDATE live_events SET peak_viewers = MAX(peak_viewers, ?), updated_at = ? WHERE id = ?"
  ).bind(current?.count || 0, now, eventId).run();
  return { peakViewers: current?.count || 0 };
}

export async function banViewer(env, { eventId, userId }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE live_viewers SET is_banned = 1, left_at = ? WHERE event_id = ? AND user_id = ?"
  ).bind(now, eventId, userId).run();
  return { banned: true };
}

export async function muteViewer(env, { eventId, userId, muted }) {
  await env.DB.prepare(
    "UPDATE live_viewers SET is_muted = ? WHERE event_id = ? AND user_id = ?"
  ).bind(muted ? 1 : 0, eventId, userId).run();
  return { muted };
}

export async function listViewers(env, { eventId, role, limit = 100 }) {
  let sql = "SELECT * FROM live_viewers WHERE event_id = ? AND left_at IS NULL";
  const params = [eventId];
  if (role) { sql += " AND role = ?"; params.push(role); }
  sql += " ORDER BY joined_at ASC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapViewerRow);
}

// --- Pinned Messages ---

export async function pinMessage(env, { eventId, projectId, messageId, pinnedBy }) {
  const id = `lp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const lastOrder = await env.DB.prepare(
    "SELECT sort_order FROM live_pinned_messages WHERE event_id = ? AND unpinned_at IS NULL ORDER BY sort_order DESC LIMIT 1"
  ).bind(eventId).first();

  await env.DB.prepare(
    `INSERT INTO live_pinned_messages (id, event_id, project_id, message_id, pinned_by, pinned_at, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, eventId, projectId, messageId, pinnedBy || null, now, (lastOrder?.sort_order || 0) + 1).run();
  return { id };
}

export async function unpinMessage(env, { pinId }) {
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE live_pinned_messages SET unpinned_at = ? WHERE id = ?").bind(now, pinId).run();
  return { unpinned: true };
}

export async function listPinnedMessages(env, { eventId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM live_pinned_messages WHERE event_id = ? AND unpinned_at IS NULL ORDER BY sort_order ASC"
  ).bind(eventId).all();
  return (rows.results || []).map(mapPinnedRow);
}

// --- Chat Messages ---

export async function sendLiveMessage(env, { eventId, projectId, userId, username, content, contentType, badge, color, replyToId }) {
  const id = `lcm_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO live_chat_messages (id, event_id, project_id, user_id, username, content, content_type, badge, color, reply_to_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, eventId, projectId, userId, username || null, content, contentType || "text", badge || null, color || null, replyToId || null, now).run();

  await env.DB.prepare(
    "UPDATE live_viewers SET message_count = message_count + 1 WHERE event_id = ? AND user_id = ? AND left_at IS NULL"
  ).bind(eventId, userId).run();

  await env.DB.prepare(
    "UPDATE live_events SET total_messages = total_messages + 1, updated_at = ? WHERE id = ?"
  ).bind(now, eventId).run();

  return { id };
}

export async function deleteLiveMessage(env, { messageId, deletedBy, reason }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE live_chat_messages SET is_deleted = 1, deleted_by = ?, deleted_reason = ? WHERE id = ?"
  ).bind(deletedBy, reason || null, messageId).run();
  return { deleted: true };
}

export async function listLiveMessages(env, { eventId, limit = 100, before }) {
  let sql = "SELECT * FROM live_chat_messages WHERE event_id = ? AND is_deleted = 0";
  const params = [eventId];
  if (before) { sql += " AND created_at < ?"; params.push(before); }
  sql += " ORDER BY created_at ASC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapMessageRow);
}

// --- Analytics ---

export async function recordAnalyticsBucket(env, { eventId, projectId, timestampBucket, messagesCount, viewersCount, peakViewers, newViewers, uniqueChatters, avgMessageLength, engagementRate }) {
  const id = `la_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO live_chat_analytics (id, event_id, project_id, timestamp_bucket, messages_count, viewers_count, peak_viewers, new_viewers, unique_chatters, avg_message_length, engagement_rate, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, eventId, projectId, timestampBucket, messagesCount || 0, viewersCount || 0, peakViewers || 0, newViewers || 0, uniqueChatters || 0, avgMessageLength || 0, engagementRate || 0, now).run();
  return { id };
}

export async function getEventAnalytics(env, { eventId, fromBucket, toBucket }) {
  let sql = "SELECT * FROM live_chat_analytics WHERE event_id = ?";
  const params = [eventId];
  if (fromBucket) { sql += " AND timestamp_bucket >= ?"; params.push(fromBucket); }
  if (toBucket) { sql += " AND timestamp_bucket <= ?"; params.push(toBucket); }
  sql += " ORDER BY timestamp_bucket ASC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapAnalyticsRow);
}

// --- Stats ---

export async function getLiveStats(env, { projectId }) {
  const events = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM live_events WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const totalMessages = await env.DB.prepare(
    "SELECT SUM(total_messages) as total FROM live_events WHERE project_id = ?"
  ).bind(projectId).first();

  const totalViewers = await env.DB.prepare(
    "SELECT SUM(total_viewers) as total FROM live_events WHERE project_id = ?"
  ).bind(projectId).first();

  return {
    events: (events.results || []).map((e) => ({ status: e.status, count: e.count })),
    totalMessages: totalMessages?.total || 0,
    totalViewers: totalViewers?.total || 0,
  };
}

// --- Helpers ---

function mapEventRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    title: row.title, description: row.description, status: row.status,
    streamUrl: row.stream_url, thumbnailUrl: row.thumbnail_url,
    category: row.category, tags: row.tags ? JSON.parse(row.tags) : null,
    startedAt: row.started_at, endedAt: row.ended_at,
    peakViewers: row.peak_viewers, totalViewers: row.total_viewers,
    totalMessages: row.total_messages, durationSeconds: row.duration_seconds,
    createdAt: row.created_at, updatedAt: row.updated_at,
    liveInputUid: row.live_input_uid, rtmpsUrl: row.rtmps_url,
    streamKey: row.stream_key, whipUrl: row.whip_url,
    playbackHls: row.playback_hls, playbackDash: row.playback_dash,
    recordingMode: row.recording_mode, preferLowLatency: row.prefer_low_latency === 1,
    providerState: row.provider_state,
  };
}

function mapRulesRow(row) {
  return {
    id: row.id, eventId: row.event_id, projectId: row.project_id,
    slowModeSeconds: row.slow_mode_seconds, emoteOnly: row.emote_only === 1,
    subscriberOnly: row.subscriber_only === 1, followerOnly: row.follower_only === 1,
    followerMinutes: row.follower_minutes, linkProtection: row.link_protection === 1,
    maxMessageLength: row.max_message_length, cooldownSeconds: row.cooldown_seconds,
    enabled: row.enabled === 1, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapViewerRow(row) {
  return {
    id: row.id, eventId: row.event_id, projectId: row.project_id,
    userId: row.user_id, username: row.username, role: row.role,
    joinedAt: row.joined_at, leftAt: row.left_at, messageCount: row.message_count,
    isBanned: row.is_banned === 1, isMuted: row.is_muted === 1,
  };
}

function mapPinnedRow(row) {
  return {
    id: row.id, eventId: row.event_id, projectId: row.project_id,
    messageId: row.message_id, pinnedBy: row.pinned_by,
    pinnedAt: row.pinned_at, unpinnedAt: row.unpinned_at, sortOrder: row.sort_order,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id, eventId: row.event_id, projectId: row.project_id,
    userId: row.user_id, username: row.username, content: row.content,
    contentType: row.content_type, isHighlighted: row.is_highlighted === 1,
    isDeleted: row.is_deleted === 1, deletedBy: row.deleted_by,
    deletedReason: row.deleted_reason, badge: row.badge, color: row.color,
    replyToId: row.reply_to_id, createdAt: row.created_at,
  };
}

function mapAnalyticsRow(row) {
  return {
    id: row.id, eventId: row.event_id, projectId: row.project_id,
    timestampBucket: row.timestamp_bucket, messagesCount: row.messages_count,
    viewersCount: row.viewers_count, peakViewers: row.peak_viewers,
    newViewers: row.new_viewers, uniqueChatters: row.unique_chatters,
    avgMessageLength: row.avg_message_length, engagementRate: row.engagement_rate,
    createdAt: row.created_at,
  };
}
