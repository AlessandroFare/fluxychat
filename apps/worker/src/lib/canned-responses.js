/**
 * CP-041: Canned responses / macros for support agents.
 */

function generateId() {
  return `cr_${crypto.randomUUID().slice(0, 12)}`;
}

export async function listCannedResponses(env, { projectId, category, limit = 100 }) {
  let sql = `SELECT id, shortcut, title, body, category, usage_count, created_at, updated_at
             FROM support_canned_responses WHERE project_id = ?`;
  const params = [projectId];
  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }
  sql += " ORDER BY usage_count DESC, shortcut ASC LIMIT ?";
  params.push(Math.min(limit, 200));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapRow);
}

export async function getCannedResponseByShortcut(env, projectId, shortcut) {
  const row = await env.DB.prepare(
    `SELECT * FROM support_canned_responses WHERE project_id = ? AND shortcut = ?`,
  )
    .bind(projectId, shortcut.trim().toLowerCase())
    .first();
  return row ? mapRow(row) : null;
}

export async function createCannedResponse(env, input) {
  const shortcut = String(input.shortcut || "").trim().toLowerCase().replace(/^\//, "");
  const title = String(input.title || "").trim();
  const body = String(input.body || "").trim();
  if (!shortcut || !title || !body) return { ok: false, error: "shortcut_title_body_required" };
  if (shortcut.length > 64 || body.length > 8000) return { ok: false, error: "field_too_long" };

  const id = generateId();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO support_canned_responses (id, project_id, shortcut, title, body, category, created_by, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
      .bind(id, input.projectId, shortcut, title, body, input.category || null, input.createdBy || null, now, now)
      .run();
  } catch (err) {
    if (String(err?.message || "").includes("UNIQUE")) return { ok: false, error: "shortcut_exists" };
    throw err;
  }
  return { ok: true, id };
}

export async function updateCannedResponse(env, { projectId, id, title, body, category }) {
  const sets = ["updated_at = ?"];
  const params = [new Date().toISOString()];
  if (title !== undefined) { sets.push("title = ?"); params.push(title); }
  if (body !== undefined) { sets.push("body = ?"); params.push(body); }
  if (category !== undefined) { sets.push("category = ?"); params.push(category); }
  params.push(id, projectId);
  const result = await env.DB.prepare(
    `UPDATE support_canned_responses SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`,
  )
    .bind(...params)
    .run();
  return { ok: true, updated: result.meta?.changes || 0 };
}

export async function deleteCannedResponse(env, projectId, id) {
  await env.DB.prepare(`DELETE FROM support_canned_responses WHERE id = ? AND project_id = ?`)
    .bind(id, projectId)
    .run();
  return { ok: true };
}

export async function recordCannedResponseUse(env, projectId, id) {
  await env.DB.prepare(
    `UPDATE support_canned_responses SET usage_count = usage_count + 1, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(new Date().toISOString(), id, projectId)
    .run();
}

function mapRow(row) {
  return {
    id: row.id,
    shortcut: row.shortcut,
    title: row.title,
    body: row.body,
    category: row.category,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
