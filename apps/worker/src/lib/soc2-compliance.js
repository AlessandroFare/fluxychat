function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Controls ---

export async function createControl(env, { projectId, controlId, name, description, trustService, category, owner, dueDate }) {
  const id = `sc_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO soc2_controls (id, project_id, control_id, name, description, trust_service, category, status, owner, due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'not_started', ?, ?, ?, ?)`
  ).bind(id, projectId, controlId, name, description || null, trustService, category || null, owner || null, dueDate || null, now, now).run();
  return { id };
}

export async function updateControl(env, { controlDbId, status, owner, verifiedBy }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (status) { sets.push("status = ?"); params.push(status); }
  if (owner) { sets.push("owner = ?"); params.push(owner); }
  if (status === "verified") { sets.push("verified_at = ?"); params.push(now); if (verifiedBy) { sets.push("verified_by = ?"); params.push(verifiedBy); } }
  params.push(controlDbId);
  await env.DB.prepare(`UPDATE soc2_controls SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function listControls(env, { projectId, trustService, status }) {
  let sql = "SELECT * FROM soc2_controls WHERE project_id = ?";
  const params = [projectId];
  if (trustService) { sql += " AND trust_service = ?"; params.push(trustService); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY trust_service, control_id";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapControlRow);
}

export async function getControl(env, { controlDbId }) {
  const row = await env.DB.prepare("SELECT * FROM soc2_controls WHERE id = ?").bind(controlDbId).first();
  return row ? mapControlRow(row) : null;
}

// --- Evidence ---

export async function addEvidence(env, { projectId, controlId, evidenceType, title, description, fileUrl, fileHash, collectedBy }) {
  const id = `se_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO soc2_evidence (id, project_id, control_id, evidence_type, title, description, file_url, file_hash, collected_by, collected_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, controlId, evidenceType, title, description || null, fileUrl || null, fileHash || null, collectedBy || null, now, now).run();
  return { id };
}

export async function listEvidence(env, { projectId, controlId }) {
  let sql = "SELECT * FROM soc2_evidence WHERE project_id = ?";
  const params = [projectId];
  if (controlId) { sql += " AND control_id = ?"; params.push(controlId); }
  sql += " ORDER BY collected_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapEvidenceRow);
}

// --- Risk assessments ---

export async function createRiskAssessment(env, { projectId, title, description, riskLevel, likelihood, impact, mitigation, owner }) {
  const id = `sr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO soc2_risk_assessments (id, project_id, title, description, risk_level, likelihood, impact, mitigation, owner, status, identified_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
  ).bind(id, projectId, title, description || null, riskLevel, likelihood, impact, mitigation || null, owner || null, now, now).run();
  return { id };
}

export async function updateRiskAssessment(env, { riskId, status, mitigation, residualRisk }) {
  const now = new Date().toISOString();
  const sets = [];
  const params = [];
  if (status) { sets.push("status = ?"); params.push(status); if (status === "closed") { sets.push("closed_at = ?"); params.push(now); } }
  if (mitigation) { sets.push("mitigation = ?"); params.push(mitigation); }
  if (residualRisk) { sets.push("residual_risk = ?"); params.push(residualRisk); }
  sets.push("reviewed_at = ?");
  params.push(now, riskId);
  await env.DB.prepare(`UPDATE soc2_risk_assessments SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function listRiskAssessments(env, { projectId, status, riskLevel }) {
  let sql = "SELECT * FROM soc2_risk_assessments WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (riskLevel) { sql += " AND risk_level = ?"; params.push(riskLevel); }
  sql += " ORDER BY identified_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapRiskRow);
}

// --- Policies ---

export async function createPolicy(env, { projectId, name, description, policyType, content, effectiveDate, owner }) {
  const id = `sp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO soc2_policies (id, project_id, name, description, policy_type, content, effective_date, status, owner, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
  ).bind(id, projectId, name, description || null, policyType, content || null, effectiveDate || null, owner || null, now, now).run();
  return { id };
}

export async function updatePolicy(env, { policyId, status, content, version }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (status) { sets.push("status = ?"); params.push(status); }
  if (content) { sets.push("content = ?"); params.push(content); }
  if (version) { sets.push("version = ?"); params.push(version); }
  params.push(policyId);
  await env.DB.prepare(`UPDATE soc2_policies SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function listPolicies(env, { projectId, policyType, status }) {
  let sql = "SELECT * FROM soc2_policies WHERE project_id = ?";
  const params = [projectId];
  if (policyType) { sql += " AND policy_type = ?"; params.push(policyType); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY name";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapPolicyRow);
}

export async function acknowledgePolicy(env, { projectId, policyId, userId, version }) {
  const id = `sa_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO soc2_policy_acknowledgments (id, project_id, policy_id, user_id, acknowledged_at, version)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, policyId, userId, now, version || "1.0").run();
  return { id };
}

export async function listPolicyAcknowledgments(env, { projectId, policyId }) {
  let sql = "SELECT * FROM soc2_policy_acknowledgments WHERE project_id = ?";
  const params = [projectId];
  if (policyId) { sql += " AND policy_id = ?"; params.push(policyId); }
  sql += " ORDER BY acknowledged_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapAckRow);
}

// --- Incidents ---

export async function createIncident(env, { projectId, title, description, severity, reportedBy }) {
  const id = `si_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO soc2_incidents (id, project_id, title, description, severity, status, detected_at, reported_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`
  ).bind(id, projectId, title, description || null, severity, now, reportedBy || null, now, now).run();
  return { id };
}

export async function updateIncident(env, { incidentId, status, assignedTo, rootCause, remediation }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (status) { sets.push("status = ?"); params.push(status); if (status === "resolved") { sets.push("resolved_at = ?"); params.push(now); } }
  if (assignedTo) { sets.push("assigned_to = ?"); params.push(assignedTo); }
  if (rootCause) { sets.push("root_cause = ?"); params.push(rootCause); }
  if (remediation) { sets.push("remediation = ?"); params.push(remediation); }
  params.push(incidentId);
  await env.DB.prepare(`UPDATE soc2_incidents SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function listIncidents(env, { projectId, status, severity }) {
  let sql = "SELECT * FROM soc2_incidents WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (severity) { sql += " AND severity = ?"; params.push(severity); }
  sql += " ORDER BY detected_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapIncidentRow);
}

// --- Reports ---

export async function createReport(env, { projectId, reportType, title, content, generatedBy, periodStart, periodEnd }) {
  const id = `srpt_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO soc2_reports (id, project_id, report_type, title, content, generated_by, period_start, period_end, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`
  ).bind(id, projectId, reportType, title, content || null, generatedBy || null, periodStart || null, periodEnd || null, now).run();
  return { id };
}

export async function updateReport(env, { reportId, status, content }) {
  const sets = [];
  const params = [];
  if (status) { sets.push("status = ?"); params.push(status); }
  if (content) { sets.push("content = ?"); params.push(content); }
  if (sets.length === 0) return { updated: 0 };
  params.push(reportId);
  await env.DB.prepare(`UPDATE soc2_reports SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function listReports(env, { projectId, reportType }) {
  let sql = "SELECT * FROM soc2_reports WHERE project_id = ?";
  const params = [projectId];
  if (reportType) { sql += " AND report_type = ?"; params.push(reportType); }
  sql += " ORDER BY created_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapReportRow);
}

// --- Dashboard ---

export async function getComplianceDashboard(env, { projectId }) {
  const controls = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM soc2_controls WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const risks = await env.DB.prepare(
    "SELECT risk_level, status, COUNT(*) as count FROM soc2_risk_assessments WHERE project_id = ? GROUP BY risk_level, status"
  ).bind(projectId).all();

  const incidents = await env.DB.prepare(
    "SELECT severity, status, COUNT(*) as count FROM soc2_incidents WHERE project_id = ? GROUP BY severity, status"
  ).bind(projectId).all();

  const policies = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM soc2_policies WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  return {
    controls: (controls.results || []).map((c) => ({ status: c.status, count: c.count })),
    risks: (risks.results || []).map((r) => ({ riskLevel: r.risk_level, status: r.status, count: r.count })),
    incidents: (incidents.results || []).map((i) => ({ severity: i.severity, status: i.status, count: i.count })),
    policies: (policies.results || []).map((p) => ({ status: p.status, count: p.count })),
  };
}

// --- Helpers ---

function mapControlRow(row) {
  return {
    id: row.id, projectId: row.project_id, controlId: row.control_id,
    name: row.name, description: row.description, trustService: row.trust_service,
    category: row.category, status: row.status, owner: row.owner, dueDate: row.due_date,
    verifiedAt: row.verified_at, verifiedBy: row.verified_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapEvidenceRow(row) {
  return {
    id: row.id, projectId: row.project_id, controlId: row.control_id,
    evidenceType: row.evidence_type, title: row.title, description: row.description,
    fileUrl: row.file_url, fileHash: row.file_hash, collectedBy: row.collected_by,
    collectedAt: row.collected_at, expiresAt: row.expires_at, createdAt: row.created_at,
  };
}

function mapRiskRow(row) {
  return {
    id: row.id, projectId: row.project_id, title: row.title, description: row.description,
    riskLevel: row.risk_level, likelihood: row.likelihood, impact: row.impact,
    mitigation: row.mitigation, residualRisk: row.residual_risk, owner: row.owner,
    status: row.status, identifiedAt: row.identified_at, reviewedAt: row.reviewed_at,
    closedAt: row.closed_at, createdAt: row.created_at,
  };
}

function mapPolicyRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, description: row.description,
    policyType: row.policy_type, version: row.version, content: row.content,
    effectiveDate: row.effective_date, reviewDate: row.review_date, status: row.status,
    owner: row.owner, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapAckRow(row) {
  return {
    id: row.id, projectId: row.project_id, policyId: row.policy_id,
    userId: row.user_id, acknowledgedAt: row.acknowledged_at, version: row.version,
  };
}

function mapIncidentRow(row) {
  return {
    id: row.id, projectId: row.project_id, title: row.title, description: row.description,
    severity: row.severity, status: row.status, detectedAt: row.detected_at,
    reportedBy: row.reported_by, assignedTo: row.assigned_to, resolvedAt: row.resolved_at,
    rootCause: row.root_cause, remediation: row.remediation,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapReportRow(row) {
  return {
    id: row.id, projectId: row.project_id, reportType: row.report_type,
    title: row.title, content: row.content, generatedBy: row.generated_by,
    periodStart: row.period_start, periodEnd: row.period_end, status: row.status,
    createdAt: row.created_at,
  };
}
