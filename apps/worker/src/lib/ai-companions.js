function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createCompanion(env, { projectId, name, avatarUrl, description, systemPrompt, personality, skills, triggerMode, triggerKeywords, temperature, maxTokens, model }) {
  const id = `acp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO ai_companions (id, project_id, name, avatar_url, description, system_prompt, personality, skills, trigger_mode, trigger_keywords, temperature, max_tokens, model, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  )
    .bind(id, projectId, name, avatarUrl || null, description || null, systemPrompt, personality ? JSON.stringify(personality) : null, skills ? JSON.stringify(skills) : null, triggerMode || "mention", triggerKeywords ? JSON.stringify(triggerKeywords) : null, temperature || 0.7, maxTokens || 1024, model || null, now, now)
    .run();
  return { id, status: "active" };
}

export async function updateCompanion(env, { companionId, name, description, systemPrompt, personality, skills, triggerMode, triggerKeywords, temperature, maxTokens, model, status }) {
  const sets = [];
  const params = [];
  const now = new Date().toISOString();

  if (name !== undefined) { sets.push("name = ?"); params.push(name); }
  if (description !== undefined) { sets.push("description = ?"); params.push(description); }
  if (systemPrompt !== undefined) { sets.push("system_prompt = ?"); params.push(systemPrompt); }
  if (personality !== undefined) { sets.push("personality = ?"); params.push(JSON.stringify(personality)); }
  if (skills !== undefined) { sets.push("skills = ?"); params.push(JSON.stringify(skills)); }
  if (triggerMode !== undefined) { sets.push("trigger_mode = ?"); params.push(triggerMode); }
  if (triggerKeywords !== undefined) { sets.push("trigger_keywords = ?"); params.push(JSON.stringify(triggerKeywords)); }
  if (temperature !== undefined) { sets.push("temperature = ?"); params.push(temperature); }
  if (maxTokens !== undefined) { sets.push("max_tokens = ?"); params.push(maxTokens); }
  if (model !== undefined) { sets.push("model = ?"); params.push(model); }
  if (status !== undefined) { sets.push("status = ?"); params.push(status); }

  if (sets.length === 0) return { updated: 0 };
  sets.push("updated_at = ?");
  params.push(now);
  params.push(companionId);

  const result = await env.DB.prepare(`UPDATE ai_companions SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: result.meta?.changes || 0 };
}

export async function getCompanion(env, { companionId }) {
  const row = await env.DB.prepare("SELECT * FROM ai_companions WHERE id = ?").bind(companionId).first();
  return row ? mapCompanionRow(row) : null;
}

export async function listCompanions(env, { projectId, status }) {
  let sql = "SELECT * FROM ai_companions WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapCompanionRow);
}

export async function deleteCompanion(env, { companionId }) {
  await env.DB.prepare("DELETE FROM ai_companion_rooms WHERE companion_id = ?").bind(companionId).run();
  await env.DB.prepare("DELETE FROM ai_companion_interactions WHERE companion_id = ?").bind(companionId).run();
  await env.DB.prepare("DELETE FROM ai_companion_memory WHERE companion_id = ?").bind(companionId).run();
  const result = await env.DB.prepare("DELETE FROM ai_companions WHERE id = ?").bind(companionId).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function assignToRoom(env, { companionId, projectId, roomId, joinMessage, leaveMessage, customPromptOverride }) {
  const existing = await env.DB.prepare(
    "SELECT id FROM ai_companion_rooms WHERE companion_id = ? AND room_id = ?"
  ).bind(companionId, roomId).first();
  if (existing) return { error: "already_assigned" };

  const id = `acr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO ai_companion_rooms (id, companion_id, project_id, room_id, is_active, join_message, leave_message, custom_prompt_override, created_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`
  )
    .bind(id, companionId, projectId, roomId, joinMessage || null, leaveMessage || null, customPromptOverride || null, now)
    .run();
  return { id };
}

export async function unassignFromRoom(env, { companionId, roomId }) {
  const result = await env.DB.prepare(
    "DELETE FROM ai_companion_rooms WHERE companion_id = ? AND room_id = ?"
  ).bind(companionId, roomId).run();
  return { removed: result.meta?.changes || 0 };
}

export async function listCompanionRooms(env, { companionId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM ai_companion_rooms WHERE companion_id = ? ORDER BY created_at ASC"
  ).bind(companionId).all();
  return (rows.results || []).map(mapRoomRow);
}

export async function listCompanionsInRoom(env, { roomId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM ai_companion_rooms WHERE room_id = ? AND is_active = 1"
  ).bind(roomId).all();
  return (rows.results || []).map(mapRoomRow);
}

export async function recordInteraction(env, { companionId, projectId, roomId, userId, inputText, outputText, tokensUsed, latencyMs, triggeredBy }) {
  const id = `aci_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO ai_companion_interactions (id, companion_id, project_id, room_id, user_id, input_text, output_text, tokens_used, latency_ms, triggered_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, companionId, projectId, roomId, userId || null, inputText, outputText, tokensUsed || 0, latencyMs || 0, triggeredBy || "manual", now)
    .run();
  return { id };
}

export async function listInteractions(env, { companionId, roomId, limit = 25 }) {
  let sql = "SELECT * FROM ai_companion_interactions WHERE companion_id = ?";
  const params = [companionId];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapInteractionRow);
}

export async function addMemory(env, { companionId, projectId, roomId, memoryType, content, source, importance, expiresAt }) {
  const id = `acm_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO ai_companion_memory (id, companion_id, project_id, room_id, memory_type, content, source, importance, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, companionId, projectId, roomId || null, memoryType || "conversation", content, source || null, importance || 0.5, expiresAt || null, now)
    .run();
  return { id };
}

export async function searchMemory(env, { companionId, roomId, query, limit = 10 }) {
  let sql = "SELECT * FROM ai_companion_memory WHERE companion_id = ?";
  const params = [companionId];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  sql += " AND content LIKE ?";
  params.push(`%${query}%`);
  sql += " ORDER BY importance DESC, created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapMemoryRow);
}

export async function getCompanionStats(env, { projectId }) {
  const companions = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM ai_companions WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const interactions = await env.DB.prepare(
    "SELECT COUNT(*) as total, AVG(tokens_used) as avg_tokens, AVG(latency_ms) as avg_latency FROM ai_companion_interactions WHERE project_id = ?"
  ).bind(projectId).first();

  const rooms = await env.DB.prepare(
    "SELECT COUNT(DISTINCT room_id) as cnt FROM ai_companion_rooms WHERE project_id = ?"
  ).bind(projectId).first();

  return {
    totalCompanions: (companions.results || []).reduce((s, c) => s + c.count, 0),
    byStatus: (companions.results || []).map((c) => ({ status: c.status, count: c.count })),
    totalInteractions: interactions?.total || 0,
    avgTokens: Math.round(interactions?.avg_tokens || 0),
    avgLatencyMs: Math.round(interactions?.avg_latency || 0),
    roomsActive: rooms?.cnt || 0,
  };
}

function mapCompanionRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    avatarUrl: row.avatar_url, description: row.description,
    systemPrompt: row.system_prompt,
    personality: row.personality ? JSON.parse(row.personality) : null,
    skills: row.skills ? JSON.parse(row.skills) : null,
    triggerMode: row.trigger_mode,
    triggerKeywords: row.trigger_keywords ? JSON.parse(row.trigger_keywords) : null,
    temperature: row.temperature, maxTokens: row.max_tokens,
    model: row.model, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRoomRow(row) {
  return {
    id: row.id, companionId: row.companion_id, projectId: row.project_id,
    roomId: row.room_id, isActive: row.is_active === 1,
    joinMessage: row.join_message, leaveMessage: row.leave_message,
    customPromptOverride: row.custom_prompt_override, createdAt: row.created_at,
  };
}

function mapInteractionRow(row) {
  return {
    id: row.id, companionId: row.companion_id, projectId: row.project_id,
    roomId: row.room_id, userId: row.user_id, inputText: row.input_text,
    outputText: row.output_text, tokensUsed: row.tokens_used,
    latencyMs: row.latency_ms, triggeredBy: row.triggered_by, createdAt: row.created_at,
  };
}

function mapMemoryRow(row) {
  return {
    id: row.id, companionId: row.companion_id, projectId: row.project_id,
    roomId: row.room_id, memoryType: row.memory_type, content: row.content,
    source: row.source, importance: row.importance, expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
