function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Profile ---

export async function upsertProfile(env, { projectId, userId, preferredSourceLang, preferredTargetLang, autoTranslate }) {
  const id = `vtp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    "SELECT id FROM voice_translation_profiles WHERE project_id = ? AND user_id = ?"
  ).bind(projectId, userId).first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE voice_translation_profiles SET preferred_source_lang = COALESCE(?, preferred_source_lang), preferred_target_lang = COALESCE(?, preferred_target_lang), auto_translate = COALESCE(?, auto_translate), updated_at = ? WHERE project_id = ? AND user_id = ?`
    ).bind(preferredSourceLang || null, preferredTargetLang || null, autoTranslate !== undefined ? (autoTranslate ? 1 : 0) : null, now, projectId, userId).run();
    return { id: existing.id, updated: true };
  }

  await env.DB.prepare(
    `INSERT INTO voice_translation_profiles (id, project_id, user_id, preferred_source_lang, preferred_target_lang, auto_translate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, userId, preferredSourceLang || "auto", preferredTargetLang || "en", autoTranslate !== undefined ? (autoTranslate ? 1 : 0) : 1, now, now)
    .run();
  return { id, created: true };
}

export async function getProfile(env, { projectId, userId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM voice_translation_profiles WHERE project_id = ? AND user_id = ?"
  ).bind(projectId, userId).first();
  return row ? mapProfileRow(row) : null;
}

// --- Room config ---

export async function upsertRoomConfig(env, { projectId, roomId, enabled, defaultSourceLang, defaultTargetLang, translateOnJoin }) {
  const id = `vtr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    "SELECT id FROM voice_translation_rooms WHERE project_id = ? AND room_id = ?"
  ).bind(projectId, roomId).first();

  if (existing) {
    const sets = [];
    const params = [];
    if (enabled !== undefined) { sets.push("enabled = ?"); params.push(enabled ? 1 : 0); }
    if (defaultSourceLang) { sets.push("default_source_lang = ?"); params.push(defaultSourceLang); }
    if (defaultTargetLang) { sets.push("default_target_lang = ?"); params.push(defaultTargetLang); }
    if (translateOnJoin !== undefined) { sets.push("translate_on_join = ?"); params.push(translateOnJoin ? 1 : 0); }
    sets.push("updated_at = ?");
    params.push(now, projectId, roomId);
    await env.DB.prepare(`UPDATE voice_translation_rooms SET ${sets.join(", ")} WHERE project_id = ? AND room_id = ?`).bind(...params).run();
    return { id: existing.id, updated: true };
  }

  await env.DB.prepare(
    `INSERT INTO voice_translation_rooms (id, project_id, room_id, enabled, default_source_lang, default_target_lang, translate_on_join, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, roomId, enabled !== undefined ? (enabled ? 1 : 0) : 1, defaultSourceLang || "auto", defaultTargetLang || "en", translateOnJoin ? 1 : 0, now, now)
    .run();
  return { id, created: true };
}

export async function getRoomConfig(env, { projectId, roomId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM voice_translation_rooms WHERE project_id = ? AND room_id = ?"
  ).bind(projectId, roomId).first();
  return row ? mapRoomRow(row) : null;
}

// --- Translation jobs ---

export async function createJob(env, { projectId, roomId, userId, sourceLang, targetLang, sourceText }) {
  const id = `vtj_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO voice_translation_jobs (id, project_id, room_id, user_id, source_lang, target_lang, source_text, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).bind(id, projectId, roomId, userId || null, sourceLang || "auto", targetLang || "en", sourceText || null, now).run();
  return { id, status: "pending" };
}

export async function completeJob(env, { jobId, sourceLang, translatedText, confidence, provider, durationMs }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE voice_translation_jobs SET source_lang = COALESCE(?, source_lang), translated_text = ?, confidence = ?, provider = ?, duration_ms = ?, status = 'completed', completed_at = ? WHERE id = ? AND status IN ('pending', 'processing')`
  ).bind(sourceLang || null, translatedText, confidence || null, provider || null, durationMs || null, now, jobId).run();
  return { completed: result.meta?.changes || 0 };
}

export async function failJob(env, { jobId, error }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE voice_translation_jobs SET status = 'failed', error = ?, completed_at = ? WHERE id = ? AND status IN ('pending', 'processing')`
  ).bind(error, now, jobId).run();
  return { failed: result.meta?.changes || 0 };
}

export async function listJobs(env, { projectId, roomId, status, limit = 25 }) {
  let sql = "SELECT * FROM voice_translation_jobs WHERE project_id = ?";
  const params = [projectId];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapJobRow);
}

// --- Feedback ---

export async function submitFeedback(env, { projectId, jobId, userId, rating, correction }) {
  const id = `vtf_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO voice_translation_feedback (id, project_id, job_id, user_id, rating, correction, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, jobId, userId, rating, correction || null, now).run();
  return { id };
}

export async function getTranslationQuality(env, { projectId, limit = 50 }) {
  const rows = await env.DB.prepare(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as total_feedback,
            SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive,
            SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative
     FROM voice_translation_feedback WHERE project_id = ?`
  ).bind(projectId).first();
  return {
    avgRating: rows?.avg_rating || 0,
    totalFeedback: rows?.total_feedback || 0,
    positive: rows?.positive || 0,
    negative: rows?.negative || 0,
  };
}

// --- Cache ---

export async function getCachedTranslation(env, { projectId, sourceLang, targetLang, sourceHash }) {
  const row = await env.DB.prepare(
    "SELECT * FROM voice_translation_cache WHERE project_id = ? AND source_lang = ? AND target_lang = ? AND source_hash = ?"
  ).bind(projectId, sourceLang, targetLang, sourceHash).first();
  if (row) {
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE voice_translation_cache SET hit_count = hit_count + 1, last_used_at = ? WHERE id = ?").bind(now, row.id).run();
  }
  return row ? { translatedText: row.translated_text, hitCount: row.hit_count + 1 } : null;
}

export async function setCachedTranslation(env, { projectId, sourceLang, targetLang, sourceHash, translatedText }) {
  const id = `vtc_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO voice_translation_cache (id, project_id, source_lang, target_lang, source_hash, translated_text, hit_count, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(id, projectId, sourceLang, targetLang, sourceHash, translatedText, now, now).run();
  return { id };
}

// --- Stats ---

export async function getStats(env, { projectId }) {
  const total = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM voice_translation_jobs WHERE project_id = ?"
  ).bind(projectId).first();

  const byLang = await env.DB.prepare(
    "SELECT target_lang, COUNT(*) as count FROM voice_translation_jobs WHERE project_id = ? AND status = 'completed' GROUP BY target_lang ORDER BY count DESC LIMIT 10"
  ).bind(projectId).all();

  const avgConfidence = await env.DB.prepare(
    "SELECT AVG(confidence) as avg_conf FROM voice_translation_jobs WHERE project_id = ? AND status = 'completed'"
  ).bind(projectId).first();

  const avgDuration = await env.DB.prepare(
    "SELECT AVG(duration_ms) as avg_dur FROM voice_translation_jobs WHERE project_id = ? AND status = 'completed'"
  ).bind(projectId).first();

  return {
    total: total?.count || 0,
    byLanguage: (byLang.results || []).map((r) => ({ lang: r.target_lang, count: r.count })),
    avgConfidence: avgConfidence?.avg_conf || 0,
    avgDurationMs: avgDuration?.avg_dur || 0,
  };
}

// --- Helpers ---

function mapProfileRow(row) {
  return {
    id: row.id, projectId: row.project_id, userId: row.user_id,
    preferredSourceLang: row.preferred_source_lang, preferredTargetLang: row.preferred_target_lang,
    autoTranslate: row.auto_translate === 1, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRoomRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    enabled: row.enabled === 1, defaultSourceLang: row.default_source_lang,
    defaultTargetLang: row.default_target_lang, translateOnJoin: row.translate_on_join === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapJobRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id, userId: row.user_id,
    sourceLang: row.source_lang, targetLang: row.target_lang,
    sourceText: row.source_text, translatedText: row.translated_text,
    confidence: row.confidence, provider: row.provider, durationMs: row.duration_ms,
    status: row.status, error: row.error,
    createdAt: row.created_at, completedAt: row.completed_at,
  };
}
