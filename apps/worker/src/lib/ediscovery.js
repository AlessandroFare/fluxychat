function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createCase(env, { projectId, caseNumber, title, description, matter, priority, assignedTo, createdBy }) {
  if (!caseNumber || !title || !createdBy) return { error: "caseNumber, title, and createdBy are required" };
  const validStatus = ["open", "active", "review", "production", "closed"];
  const validPriority = ["low", "normal", "high", "critical"];
  if (priority && !validPriority.includes(priority)) return { error: `priority must be one of: ${validPriority.join(", ")}` };

  const id = `edc_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO ediscovery_cases (id, project_id, case_number, title, description, matter, status, priority, assigned_to, created_by, opened_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`
    )
      .bind(id, projectId, caseNumber, title, description || null, matter || null, priority || "normal", assignedTo || null, createdBy, now, now)
      .run();
    return { id, created: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return { error: "case_number_already_exists" };
    throw err;
  }
}

export async function updateCase(env, { id, projectId, title, description, matter, status, priority, assignedTo }) {
  const now = new Date().toISOString();
  const sets = [];
  const params = [];

  if (title !== undefined) { sets.push("title = ?"); params.push(title); }
  if (description !== undefined) { sets.push("description = ?"); params.push(description); }
  if (matter !== undefined) { sets.push("matter = ?"); params.push(matter); }
  if (status !== undefined) {
    sets.push("status = ?"); params.push(status);
    if (status === "closed") { sets.push("closed_at = ?"); params.push(now); }
  }
  if (priority !== undefined) { sets.push("priority = ?"); params.push(priority); }
  if (assignedTo !== undefined) { sets.push("assigned_to = ?"); params.push(assignedTo); }

  if (sets.length === 0) return { updated: 0 };

  params.push(id, projectId);
  const result = await env.DB.prepare(
    `UPDATE ediscovery_cases SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`
  )
    .bind(...params)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function getCase(env, { id, projectId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM ediscovery_cases WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .first();
  return row ? mapCaseRow(row) : null;
}

export async function listCases(env, { projectId, status, limit }) {
  let sql = "SELECT * FROM ediscovery_cases WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit || 50);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapCaseRow);
}

export async function addCustodian(env, { caseId, projectId, userId, name, email, role }) {
  if (!userId) return { error: "userId is required" };
  const id = `edcu_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO ediscovery_custodians (id, case_id, project_id, user_id, name, email, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, caseId, projectId, userId, name || null, email || null, role || "custodian", now)
    .run();
  return { id, created: true };
}

export async function listCustodians(env, { caseId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM ediscovery_custodians WHERE case_id = ? ORDER BY created_at DESC"
  )
    .bind(caseId)
    .all();
  return (rows.results || []).map(mapCustodianRow);
}

export async function preserveData(env, { caseId, projectId, roomId, userId, dataTypes, reason, expiresAt }) {
  if (!reason) return { error: "reason is required" };
  const id = `edpr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO ediscovery_preservation (id, case_id, project_id, room_id, user_id, data_types, reason, status, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  )
    .bind(id, caseId, projectId, roomId || null, userId || null, dataTypes || "messages", reason, expiresAt || null, now)
    .run();
  return { id, created: true };
}

export async function listPreservations(env, { caseId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM ediscovery_preservation WHERE case_id = ? ORDER BY created_at DESC"
  )
    .bind(caseId)
    .all();
  return (rows.results || []).map(mapPreservationRow);
}

export async function collectEvidence(env, { caseId, projectId, itemType, itemId, roomId, collectedBy, notes }) {
  if (!itemType || !itemId || !collectedBy) return { error: "itemType, itemId, and collectedBy are required" };
  const validTypes = ["message", "file", "metadata", "audit_event"];
  if (!validTypes.includes(itemType)) return { error: `itemType must be one of: ${validTypes.join(", ")}` };

  const id = `ede_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO ediscovery_evidence (id, case_id, project_id, item_type, item_id, room_id, collected_by, collected_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, caseId, projectId, itemType, itemId, roomId || null, collectedBy, now, notes || null)
      .run();

    await addCustodyRecord(env, { evidenceId: id, caseId, action: "collected", performedBy: collectedBy, details: `Collected ${itemType} ${itemId}` });
    return { id, created: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return { error: "evidence_already_collected" };
    throw err;
  }
}

export async function listEvidence(env, { caseId, itemType }) {
  let sql = "SELECT * FROM ediscovery_evidence WHERE case_id = ?";
  const params = [caseId];
  if (itemType) { sql += " AND item_type = ?"; params.push(itemType); }
  sql += " ORDER BY collected_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapEvidenceRow);
}

export async function addCustodyRecord(env, { evidenceId, caseId, action, performedBy, details }) {
  const id = `edco_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO ediscovery_chain_of_custody (id, evidence_id, case_id, action, performed_by, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, evidenceId, caseId, action, performedBy, details || null, now)
    .run();
  return { id };
}

export async function getChainOfCustody(env, { evidenceId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM ediscovery_chain_of_custody WHERE evidence_id = ? ORDER BY timestamp ASC"
  )
    .bind(evidenceId)
    .all();
  return (rows.results || []).map(mapCocRow);
}

export async function getCaseStats(env, { projectId }) {
  const cases = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM ediscovery_cases WHERE project_id = ? GROUP BY status"
  )
    .bind(projectId)
    .all();

  const evidence = await env.DB.prepare(
    "SELECT item_type, COUNT(*) as count FROM ediscovery_evidence WHERE project_id = ? GROUP BY item_type"
  )
    .bind(projectId)
    .all();

  const byStatus = {};
  for (const c of cases.results || []) byStatus[c.status] = c.count;
  const byEvidenceType = {};
  for (const e of evidence.results || []) byEvidenceType[e.item_type] = e.count;

  return {
    totalCases: Object.values(byStatus).reduce((s, c) => s + c, 0),
    byStatus,
    totalEvidence: Object.values(byEvidenceType).reduce((s, c) => s + c, 0),
    byEvidenceType,
  };
}

function mapCaseRow(row) {
  return {
    id: row.id, projectId: row.project_id, caseNumber: row.case_number,
    title: row.title, description: row.description, matter: row.matter,
    status: row.status, priority: row.priority, assignedTo: row.assigned_to,
    createdBy: row.created_by, openedAt: row.opened_at, closedAt: row.closed_at,
    createdAt: row.created_at,
  };
}

function mapCustodianRow(row) {
  return {
    id: row.id, caseId: row.case_id, projectId: row.project_id,
    userId: row.user_id, name: row.name, email: row.email, role: row.role,
    preservedAt: row.preserved_at, releasedAt: row.released_at, createdAt: row.created_at,
  };
}

function mapPreservationRow(row) {
  return {
    id: row.id, caseId: row.case_id, projectId: row.project_id,
    roomId: row.room_id, userId: row.user_id, dataTypes: row.data_types,
    reason: row.reason, status: row.status, expiresAt: row.expires_at, createdAt: row.created_at,
  };
}

function mapEvidenceRow(row) {
  return {
    id: row.id, caseId: row.case_id, projectId: row.project_id,
    itemType: row.item_type, itemId: row.item_id, roomId: row.room_id,
    collectedBy: row.collected_by, collectedAt: row.collected_at,
    hash: row.hash, notes: row.notes,
  };
}

function mapCocRow(row) {
  return {
    id: row.id, evidenceId: row.evidence_id, caseId: row.case_id,
    action: row.action, performedBy: row.performed_by, details: row.details, timestamp: row.timestamp,
  };
}
