function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- BAA ---

export async function createBAA(env, { projectId, entityName, entityType, contactName, contactEmail, effectiveDate, expirationDate, documentUrl }) {
  const id = `hba_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO hipaa_baa (id, project_id, entity_name, entity_type, contact_name, contact_email, status, effective_date, expiration_date, document_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
  ).bind(id, projectId, entityName, entityType, contactName || null, contactEmail || null, effectiveDate || null, expirationDate || null, documentUrl || null, now, now).run();
  return { id };
}

export async function updateBAA(env, { baaId, status, signedBy }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (status) { sets.push("status = ?"); params.push(status); if (status === "active") { sets.push("signed_at = ?"); params.push(now); } }
  if (signedBy) { sets.push("signed_by = ?"); params.push(signedBy); }
  params.push(baaId);
  await env.DB.prepare(`UPDATE hipaa_baa SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function listBAAs(env, { projectId, status }) {
  let sql = "SELECT * FROM hipaa_baa WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapBAARow);
}

// --- PHI Access ---

export async function logPHIAccess(env, { projectId, userId, phiType, resourceType, resourceId, action, purpose, ipAddress, userAgent }) {
  const id = `hpa_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO hipaa_phi_access_log (id, project_id, user_id, phi_type, resource_type, resource_id, action, purpose, minimum_necessary, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
  ).bind(id, projectId, userId, phiType, resourceType, resourceId || null, action, purpose, ipAddress || null, userAgent || null, now).run();
  return { id };
}

export async function listPHIAccessLogs(env, { projectId, userId, phiType, limit = 50 }) {
  let sql = "SELECT * FROM hipaa_phi_access_log WHERE project_id = ?";
  const params = [projectId];
  if (userId) { sql += " AND user_id = ?"; params.push(userId); }
  if (phiType) { sql += " AND phi_type = ?"; params.push(phiType); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapPHIAccessRow);
}

// --- PHI Detection ---

export async function logPHIDetection(env, { projectId, roomId, messageId, detectedType, confidence, originalText, maskedText, actionTaken }) {
  const id = `hpd_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO hipaa_phi_detection (id, project_id, room_id, message_id, detected_type, confidence, original_text, masked_text, action_taken, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId || null, messageId || null, detectedType, confidence, originalText || null, maskedText || null, actionTaken, now).run();
  return { id };
}

export async function listPHIDetections(env, { projectId, roomId, detectedType, actionTaken, limit = 50 }) {
  let sql = "SELECT * FROM hipaa_phi_detection WHERE project_id = ?";
  const params = [projectId];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  if (detectedType) { sql += " AND detected_type = ?"; params.push(detectedType); }
  if (actionTaken) { sql += " AND action_taken = ?"; params.push(actionTaken); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapPHIDetectionRow);
}

export async function reviewPHIDetection(env, { detectionId, actionTaken, reviewedBy }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE hipaa_phi_detection SET action_taken = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?"
  ).bind(actionTaken, reviewedBy, now, detectionId).run();
  return { reviewed: true };
}

// --- Breach log ---

export async function createBreach(env, { projectId, title, description, phiTypesAffected, individualsAffected, severity, reportedBy }) {
  const id = `hb_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO hipaa_breach_log (id, project_id, title, description, phi_types_affected, individuals_affected, severity, status, discovered_at, reported_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'discovered', ?, ?, ?, ?)`
  ).bind(id, projectId, title, description || null, phiTypesAffected, individualsAffected || 0, severity, now, reportedBy || null, now, now).run();
  return { id };
}

export async function updateBreach(env, { breachId, status, rootCause, remediation }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (status) { sets.push("status = ?"); params.push(status); if (status === "contained") { sets.push("contained_at = ?"); params.push(now); } if (status === "notified") { sets.push("individuals_notified_at = ?"); params.push(now); } }
  if (rootCause) { sets.push("root_cause = ?"); params.push(rootCause); }
  if (remediation) { sets.push("remediation = ?"); params.push(remediation); }
  params.push(breachId);
  await env.DB.prepare(`UPDATE hipaa_breach_log SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function listBreaches(env, { projectId, status, severity }) {
  let sql = "SELECT * FROM hipaa_breach_log WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (severity) { sql += " AND severity = ?"; params.push(severity); }
  sql += " ORDER BY discovered_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapBreachRow);
}

// --- Training ---

export async function assignTraining(env, { projectId, userId, trainingType, expiresAt }) {
  const id = `ht_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO hipaa_training (id, project_id, user_id, training_type, status, assigned_at, expires_at, created_at)
     VALUES (?, ?, ?, ?, 'assigned', ?, ?, ?)`
  ).bind(id, projectId, userId, trainingType, now, expiresAt || null, now).run();
  return { id };
}

export async function completeTraining(env, { trainingId, score, certificateUrl }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE hipaa_training SET status = 'completed', completed_at = ?, score = ?, certificate_url = ? WHERE id = ?"
  ).bind(now, score || null, certificateUrl || null, trainingId).run();
  return { completed: true };
}

export async function listTrainings(env, { projectId, userId, status }) {
  let sql = "SELECT * FROM hipaa_training WHERE project_id = ?";
  const params = [projectId];
  if (userId) { sql += " AND user_id = ?"; params.push(userId); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY assigned_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapTrainingRow);
}

// --- Encryption ---

export async function configureEncryption(env, { projectId, dataType, algorithm, keyManagement, nextRotationAt }) {
  const id = `he_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO hipaa_encryption (id, project_id, data_type, algorithm, key_management, status, last_rotated_at, next_rotation_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
  ).bind(id, projectId, dataType, algorithm || "AES-256", keyManagement || null, now, nextRotationAt || null, now, now).run();
  return { id };
}

export async function listEncryptionConfigs(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM hipaa_encryption WHERE project_id = ? ORDER BY data_type"
  ).bind(projectId).all();
  return (rows.results || []).map(mapEncryptionRow);
}

// --- Audit log ---

export async function logAuditEvent(env, { projectId, eventType, userId, details, ipAddress, userAgent }) {
  const id = `hal_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO hipaa_audit_log (id, project_id, event_type, user_id, details, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, eventType, userId || null, details ? JSON.stringify(details) : null, ipAddress || null, userAgent || null, now).run();
  return { id };
}

export async function listAuditLogs(env, { projectId, eventType, userId, limit = 50 }) {
  let sql = "SELECT * FROM hipaa_audit_log WHERE project_id = ?";
  const params = [projectId];
  if (eventType) { sql += " AND event_type = ?"; params.push(eventType); }
  if (userId) { sql += " AND user_id = ?"; params.push(userId); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapAuditRow);
}

// --- Dashboard ---

export async function getHIPAADashboard(env, { projectId }) {
  const baaStatus = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM hipaa_baa WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const phiAccess = await env.DB.prepare(
    "SELECT action, COUNT(*) as count FROM hipaa_phi_access_log WHERE project_id = ? GROUP BY action"
  ).bind(projectId).all();

  const phiDetections = await env.DB.prepare(
    "SELECT detected_type, action_taken, COUNT(*) as count FROM hipaa_phi_detection WHERE project_id = ? GROUP BY detected_type, action_taken"
  ).bind(projectId).all();

  const breaches = await env.DB.prepare(
    "SELECT status, severity, COUNT(*) as count FROM hipaa_breach_log WHERE project_id = ? GROUP BY status, severity"
  ).bind(projectId).all();

  const training = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM hipaa_training WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  return {
    baaStatus: (baaStatus.results || []).map((r) => ({ status: r.status, count: r.count })),
    phiAccess: (phiAccess.results || []).map((r) => ({ action: r.action, count: r.count })),
    phiDetections: (phiDetections.results || []).map((r) => ({ type: r.detected_type, action: r.action_taken, count: r.count })),
    breaches: (breaches.results || []).map((r) => ({ status: r.status, severity: r.severity, count: r.count })),
    training: (training.results || []).map((r) => ({ status: r.status, count: r.count })),
  };
}

// --- Helpers ---

function mapBAARow(row) {
  return {
    id: row.id, projectId: row.project_id, entityName: row.entity_name,
    entityType: row.entity_type, contactName: row.contact_name, contactEmail: row.contact_email,
    status: row.status, effectiveDate: row.effective_date, expirationDate: row.expiration_date,
    signedAt: row.signed_at, signedBy: row.signed_by, documentUrl: row.document_url,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapPHIAccessRow(row) {
  return {
    id: row.id, projectId: row.project_id, userId: row.user_id,
    phiType: row.phi_type, resourceType: row.resource_type, resourceId: row.resource_id,
    action: row.action, purpose: row.purpose, minimumNecessary: row.minimum_necessary === 1,
    ipAddress: row.ip_address, userAgent: row.user_agent, createdAt: row.created_at,
  };
}

function mapPHIDetectionRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id, messageId: row.message_id,
    detectedType: row.detected_type, confidence: row.confidence,
    originalText: row.original_text, maskedText: row.masked_text,
    actionTaken: row.action_taken, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

function mapBreachRow(row) {
  return {
    id: row.id, projectId: row.project_id, title: row.title, description: row.description,
    phiTypesAffected: row.phi_types_affected, individualsAffected: row.individuals_affected,
    severity: row.severity, status: row.status, discoveredAt: row.discovered_at,
    containedAt: row.contained_at, hhsNotifiedAt: row.hhs_notified_at,
    individualsNotifiedAt: row.individuals_notified_at, rootCause: row.root_cause,
    remediation: row.remediation, reportedBy: row.reported_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapTrainingRow(row) {
  return {
    id: row.id, projectId: row.project_id, userId: row.user_id,
    trainingType: row.training_type, status: row.status, assignedAt: row.assigned_at,
    startedAt: row.started_at, completedAt: row.completed_at, expiresAt: row.expires_at,
    score: row.score, certificateUrl: row.certificate_url, createdAt: row.created_at,
  };
}

function mapEncryptionRow(row) {
  return {
    id: row.id, projectId: row.project_id, dataType: row.data_type,
    algorithm: row.algorithm, keyManagement: row.key_management, status: row.status,
    lastRotatedAt: row.last_rotated_at, nextRotationAt: row.next_rotation_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapAuditRow(row) {
  return {
    id: row.id, projectId: row.project_id, eventType: row.event_type,
    userId: row.user_id, details: row.details ? JSON.parse(row.details) : null,
    ipAddress: row.ip_address, userAgent: row.user_agent, createdAt: row.created_at,
  };
}
