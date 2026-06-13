function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Conversation management ---

export async function createConversation(env, { projectId, roomId, startedByCompanionId, startedByUserId, title, conversationType }) {
  const id = `cc_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO companion_conversations (id, project_id, room_id, started_by_companion_id, started_by_user_id, title, status, conversation_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  )
    .bind(id, projectId, roomId, startedByCompanionId || null, startedByUserId || null, title || null, conversationType || "group", now)
    .run();
  return { id, status: "active" };
}

export async function endConversation(env, { conversationId }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE companion_conversations SET status = 'ended', ended_at = ? WHERE id = ? AND status IN ('active', 'paused')"
  ).bind(now, conversationId).run();
  return { ended: result.meta?.changes || 0 };
}

export async function getConversation(env, { conversationId }) {
  const row = await env.DB.prepare("SELECT * FROM companion_conversations WHERE id = ?").bind(conversationId).first();
  return row ? mapConversationRow(row) : null;
}

export async function listConversations(env, { projectId, roomId, status, limit = 25 }) {
  let sql = "SELECT * FROM companion_conversations WHERE project_id = ?";
  const params = [projectId];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapConversationRow);
}

// --- Participant management ---

export async function addParticipant(env, { conversationId, participantType, participantId, role }) {
  const existing = await env.DB.prepare(
    "SELECT id FROM companion_conversation_participants WHERE conversation_id = ? AND participant_type = ? AND participant_id = ? AND left_at IS NULL"
  ).bind(conversationId, participantType, participantId).first();
  if (existing) return { error: "already_participant" };

  const id = `ccp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO companion_conversation_participants (id, conversation_id, participant_type, participant_id, role, joined_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, conversationId, participantType, participantId, role || "participant", now, now)
    .run();
  return { id };
}

export async function removeParticipant(env, { conversationId, participantType, participantId }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE companion_conversation_participants SET left_at = ? WHERE conversation_id = ? AND participant_type = ? AND participant_id = ? AND left_at IS NULL"
  ).bind(now, conversationId, participantType, participantId).run();
  return { removed: result.meta?.changes || 0 };
}

export async function listParticipants(env, { conversationId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM companion_conversation_participants WHERE conversation_id = ? ORDER BY joined_at ASC"
  ).bind(conversationId).all();
  return (rows.results || []).map(mapParticipantRow);
}

// --- Messages ---

export async function sendCompanionMessage(env, { conversationId, projectId, senderType, senderId, content, contentType, replyToId, metadata }) {
  const id = `cm_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO companion_messages (id, conversation_id, project_id, sender_type, sender_id, content, content_type, reply_to_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, conversationId, projectId, senderType, senderId, content, contentType || "text", replyToId || null, metadata ? JSON.stringify(metadata) : null, now)
    .run();

  await env.DB.prepare(
    "UPDATE companion_conversation_participants SET last_active_at = ? WHERE conversation_id = ? AND participant_type = ? AND participant_id = ?"
  ).bind(now, conversationId, senderType, senderId).run();

  return { id };
}

export async function listConversationMessages(env, { conversationId, limit = 50, before }) {
  let sql = "SELECT * FROM companion_messages WHERE conversation_id = ?";
  const params = [conversationId];
  if (before) { sql += " AND created_at < ?"; params.push(before); }
  sql += " ORDER BY created_at ASC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapMessageRow);
}

// --- Personality learning ---

export async function logPersonalityShift(env, { companionId, projectId, trait, oldValue, newValue, reason, interactionId }) {
  const id = `cpl_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO companion_personality_log (id, companion_id, project_id, trait, old_value, new_value, reason, interaction_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, companionId, projectId, trait, oldValue, newValue, reason || null, interactionId || null, now)
    .run();
  return { id };
}

export async function getPersonalityHistory(env, { companionId, trait, limit = 20 }) {
  let sql = "SELECT * FROM companion_personality_log WHERE companion_id = ?";
  const params = [companionId];
  if (trait) { sql += " AND trait = ?"; params.push(trait); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapPersonalityRow);
}

// --- Emotion tracking ---

export async function setEmotionState(env, { companionId, projectId, roomId, emotion, intensity, triggerEvent }) {
  const id = `ces_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO companion_emotion_state (id, companion_id, project_id, room_id, emotion, intensity, trigger_event, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, companionId, projectId, roomId || null, emotion, intensity || 0.5, triggerEvent || null, now)
    .run();
  return { id };
}

export async function getRecentEmotions(env, { companionId, roomId, limit = 10 }) {
  let sql = "SELECT * FROM companion_emotion_state WHERE companion_id = ?";
  const params = [companionId];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapEmotionRow);
}

export async function getCurrentEmotion(env, { companionId, roomId }) {
  let sql = "SELECT * FROM companion_emotion_state WHERE companion_id = ?";
  const params = [companionId];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  sql += " ORDER BY created_at DESC LIMIT 1";
  const row = await env.DB.prepare(sql).bind(...params).first();
  return row ? mapEmotionRow(row) : null;
}

// --- Delegation ---

export async function createDelegation(env, { projectId, roomId, fromCompanionId, fromUserId, toCompanionId, toUserId, delegationType, reason, context }) {
  const id = `cd_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO companion_delegations (id, project_id, room_id, from_companion_id, from_user_id, to_companion_id, to_user_id, delegation_type, reason, context, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  )
    .bind(id, projectId, roomId, fromCompanionId || null, fromUserId || null, toCompanionId || null, toUserId || null, delegationType, reason || null, context ? JSON.stringify(context) : null, now)
    .run();
  return { id, status: "pending" };
}

export async function resolveDelegation(env, { delegationId, status }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE companion_delegations SET status = ?, resolved_at = ? WHERE id = ? AND status = 'pending'"
  ).bind(status, now, delegationId).run();
  return { resolved: result.meta?.changes || 0 };
}

export async function listDelegations(env, { projectId, roomId, status, limit = 25 }) {
  let sql = "SELECT * FROM companion_delegations WHERE project_id = ?";
  const params = [projectId];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapDelegationRow);
}

// --- Stats ---

export async function getAdvancedStats(env, { projectId }) {
  const conversations = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM companion_conversations WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const messages = await env.DB.prepare(
    "SELECT sender_type, COUNT(*) as count FROM companion_messages WHERE project_id = ? GROUP BY sender_type"
  ).bind(projectId).all();

  const emotions = await env.DB.prepare(
    "SELECT emotion, COUNT(*) as count FROM companion_emotion_state WHERE project_id = ? GROUP BY emotion ORDER BY count DESC LIMIT 5"
  ).bind(projectId).all();

  const delegations = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM companion_delegations WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  return {
    conversations: (conversations.results || []).map((c) => ({ status: c.status, count: c.count })),
    messages: (messages.results || []).map((m) => ({ senderType: m.sender_type, count: m.count })),
    topEmotions: (emotions.results || []).map((e) => ({ emotion: e.emotion, count: e.count })),
    delegations: (delegations.results || []).map((d) => ({ status: d.status, count: d.count })),
  };
}

// --- Helpers ---

function mapConversationRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    startedByCompanionId: row.started_by_companion_id, startedByUserId: row.started_by_user_id,
    title: row.title, status: row.status, conversationType: row.conversation_type,
    createdAt: row.created_at, endedAt: row.ended_at,
  };
}

function mapParticipantRow(row) {
  return {
    id: row.id, conversationId: row.conversation_id, participantType: row.participant_type,
    participantId: row.participant_id, role: row.role,
    joinedAt: row.joined_at, leftAt: row.left_at, lastActiveAt: row.last_active_at,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id, conversationId: row.conversation_id, projectId: row.project_id,
    senderType: row.sender_type, senderId: row.sender_id, content: row.content,
    contentType: row.content_type, replyToId: row.reply_to_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : null, createdAt: row.created_at,
  };
}

function mapPersonalityRow(row) {
  return {
    id: row.id, companionId: row.companion_id, projectId: row.project_id,
    trait: row.trait, oldValue: row.old_value, newValue: row.new_value,
    reason: row.reason, interactionId: row.interaction_id, createdAt: row.created_at,
  };
}

function mapEmotionRow(row) {
  return {
    id: row.id, companionId: row.companion_id, projectId: row.project_id,
    roomId: row.room_id, emotion: row.emotion, intensity: row.intensity,
    triggerEvent: row.trigger_event, createdAt: row.created_at,
  };
}

function mapDelegationRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    fromCompanionId: row.from_companion_id, fromUserId: row.from_user_id,
    toCompanionId: row.to_companion_id, toUserId: row.to_user_id,
    delegationType: row.delegation_type, reason: row.reason,
    context: row.context ? JSON.parse(row.context) : null,
    status: row.status, createdAt: row.created_at, resolvedAt: row.resolved_at,
  };
}
