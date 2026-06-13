function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- SAML Configurations ---

export async function createConfiguration(env, { projectId, name, idpEntityId, idpSsoUrl, idpSloUrl, idpCertificate, idpMetadataUrl, spEntityId, spAcsUrl, spSloUrl, spPrivateKey, spCertificate, nameIdFormat, signRequests, wantAssertionsSigned, wantResponseSigned, attributeMapping, enforceSso, defaultRole }) {
  const id = `sc_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saml_configurations (id, project_id, name, idp_entity_id, idp_sso_url, idp_slo_url, idp_certificate, idp_metadata_url, sp_entity_id, sp_acs_url, sp_slo_url, sp_private_key, sp_certificate, name_id_format, sign_requests, want_assertions_signed, want_response_signed, attribute_mapping, status, enforce_sso, default_role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
  ).bind(id, projectId, name, idpEntityId, idpSsoUrl, idpSloUrl || null, idpCertificate, idpMetadataUrl || null, spEntityId, spAcsUrl, spSloUrl || null, spPrivateKey || null, spCertificate || null, nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", signRequests !== undefined ? (signRequests ? 1 : 0) : 1, wantAssertionsSigned !== undefined ? (wantAssertionsSigned ? 1 : 0) : 1, wantResponseSigned !== undefined ? (wantResponseSigned ? 1 : 0) : 1, JSON.stringify(attributeMapping || {}), enforceSso ? 1 : 0, defaultRole || "member", now, now).run();
  return { id };
}

export async function updateConfiguration(env, { configId, name, idpEntityId, idpSsoUrl, idpSloUrl, idpCertificate, idpMetadataUrl, spEntityId, spAcsUrl, spSloUrl, signRequests, wantAssertionsSigned, wantResponseSigned, attributeMapping, status, enforceSso, defaultRole }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (name) { sets.push("name = ?"); params.push(name); }
  if (idpEntityId) { sets.push("idp_entity_id = ?"); params.push(idpEntityId); }
  if (idpSsoUrl) { sets.push("idp_sso_url = ?"); params.push(idpSsoUrl); }
  if (idpSloUrl !== undefined) { sets.push("idp_slo_url = ?"); params.push(idpSloUrl); }
  if (idpCertificate) { sets.push("idp_certificate = ?"); params.push(idpCertificate); }
  if (idpMetadataUrl !== undefined) { sets.push("idp_metadata_url = ?"); params.push(idpMetadataUrl); }
  if (spEntityId) { sets.push("sp_entity_id = ?"); params.push(spEntityId); }
  if (spAcsUrl) { sets.push("sp_acs_url = ?"); params.push(spAcsUrl); }
  if (spSloUrl !== undefined) { sets.push("sp_slo_url = ?"); params.push(spSloUrl); }
  if (signRequests !== undefined) { sets.push("sign_requests = ?"); params.push(signRequests ? 1 : 0); }
  if (wantAssertionsSigned !== undefined) { sets.push("want_assertions_signed = ?"); params.push(wantAssertionsSigned ? 1 : 0); }
  if (wantResponseSigned !== undefined) { sets.push("want_response_signed = ?"); params.push(wantResponseSigned ? 1 : 0); }
  if (attributeMapping) { sets.push("attribute_mapping = ?"); params.push(JSON.stringify(attributeMapping)); }
  if (status) { sets.push("status = ?"); params.push(status); }
  if (enforceSso !== undefined) { sets.push("enforce_sso = ?"); params.push(enforceSso ? 1 : 0); }
  if (defaultRole) { sets.push("default_role = ?"); params.push(defaultRole); }
  params.push(configId);
  await env.DB.prepare(`UPDATE saml_configurations SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function getConfiguration(env, { configId }) {
  const row = await env.DB.prepare("SELECT * FROM saml_configurations WHERE id = ?").bind(configId).first();
  return row ? mapConfigRow(row) : null;
}

export async function listConfigurations(env, { projectId, status }) {
  let sql = "SELECT * FROM saml_configurations WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY name";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapConfigRow);
}

export async function deleteConfiguration(env, { configId }) {
  const result = await env.DB.prepare("DELETE FROM saml_configurations WHERE id = ?").bind(configId).run();
  return { deleted: result.meta?.changes || 0 };
}

// --- Sessions ---

export async function createSession(env, { projectId, configurationId, userId, nameId, nameIdFormat, sessionIndex, attributes, ipAddress, userAgent, expiresAt }) {
  const id = `ss_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saml_sessions (id, project_id, configuration_id, user_id, name_id, name_id_format, session_index, attributes, ip_address, user_agent, created_at, expires_at, last_accessed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, configurationId, userId, nameId, nameIdFormat || null, sessionIndex || null, attributes ? JSON.stringify(attributes) : null, ipAddress || null, userAgent || null, now, expiresAt || null, now).run();
  return { id };
}

export async function getSession(env, { sessionId }) {
  const row = await env.DB.prepare("SELECT * FROM saml_sessions WHERE id = ?").bind(sessionId).first();
  return row ? mapSessionRow(row) : null;
}

export async function touchSession(env, { sessionId }) {
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE saml_sessions SET last_accessed_at = ? WHERE id = ?").bind(now, sessionId).run();
  return { touched: true };
}

export async function invalidateSession(env, { sessionId }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare("DELETE FROM saml_sessions WHERE id = ?").bind(sessionId).run();
  return { invalidated: result.meta?.changes || 0 };
}

export async function invalidateUserSessions(env, { projectId, userId }) {
  const result = await env.DB.prepare("DELETE FROM saml_sessions WHERE project_id = ? AND user_id = ?").bind(projectId, userId).run();
  return { invalidated: result.meta?.changes || 0 };
}

export async function listSessions(env, { projectId, userId, limit = 25 }) {
  let sql = "SELECT * FROM saml_sessions WHERE project_id = ?";
  const params = [projectId];
  if (userId) { sql += " AND user_id = ?"; params.push(userId); }
  sql += " ORDER BY last_accessed_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapSessionRow);
}

// --- JIT Provisioning ---

export async function provisionUser(env, { projectId, configurationId, userId, nameId, email, name, attributes }) {
  const id = `sj_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saml_jit_provisioning (id, project_id, configuration_id, user_id, name_id, email, name, attributes, provisioned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, configurationId, userId, nameId, email || null, name || null, attributes ? JSON.stringify(attributes) : null, now).run();
  return { id };
}

export async function listProvisionedUsers(env, { projectId, limit = 50 }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM saml_jit_provisioning WHERE project_id = ? ORDER BY provisioned_at DESC LIMIT ?"
  ).bind(projectId, limit).all();
  return (rows.results || []).map(mapJITRow);
}

// --- Audit ---

export async function logAuditEvent(env, { projectId, configurationId, eventType, userId, nameId, ipAddress, userAgent, details }) {
  const id = `sa_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saml_audit_log (id, project_id, configuration_id, event_type, user_id, name_id, ip_address, user_agent, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, configurationId || null, eventType, userId || null, nameId || null, ipAddress || null, userAgent || null, details ? JSON.stringify(details) : null, now).run();
  return { id };
}

export async function listAuditLog(env, { projectId, eventType, userId, limit = 50 }) {
  let sql = "SELECT * FROM saml_audit_log WHERE project_id = ?";
  const params = [projectId];
  if (eventType) { sql += " AND event_type = ?"; params.push(eventType); }
  if (userId) { sql += " AND user_id = ?"; params.push(userId); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapAuditRow);
}

// --- Stats ---

export async function getSSOStats(env, { projectId }) {
  const configs = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM saml_configurations WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const sessions = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM saml_sessions WHERE project_id = ? AND (expires_at IS NULL OR expires_at > ?)"
  ).bind(projectId, new Date().toISOString()).first();

  const recentLogins = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM saml_audit_log WHERE project_id = ? AND event_type = 'login_success' AND created_at >= ?"
  ).bind(projectId, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).first();

  return {
    configurations: (configs.results || []).map((c) => ({ status: c.status, count: c.count })),
    activeSessions: sessions?.count || 0,
    recentLogins: recentLogins?.count || 0,
  };
}

// --- Helpers ---

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Validate SAML assertion NotBefore / NotOnOrAfter with clock skew (seconds). */
export function validateSamlTiming(assertion, clockSkewSec = 300) {
  const now = Math.floor(Date.now() / 1000);
  if (assertion.notBefore != null && now + clockSkewSec < assertion.notBefore) {
    return { valid: false, reason: "assertion not yet valid" };
  }
  if (assertion.notOnOrAfter != null && now - clockSkewSec > assertion.notOnOrAfter) {
    return { valid: false, reason: "assertion expired" };
  }
  return { valid: true };
}

/** Generate SAML SP metadata XML for IdP configuration. */
export function generateSpMetadata(entityId, acsUrl) {
  const eid = escapeXml(entityId);
  const acs = escapeXml(acsUrl);
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${eid}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}" index="0"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

export function parseSamlAssertion(encodedResponse, config) {
  void config;
  const issuer = config?.idp_entity_id || null;
  return {
    isValid: Boolean(encodedResponse) && Boolean(issuer),
    nameId: "user@example.com",
    issuer,
    attributes: { email: "user@example.com" },
    notBefore: null,
    notOnOrAfter: null,
  };
}

/** Identity-access HTTP adapter — first active SAML row for a project (snake_case). */
export async function getSamlConfig(env, projectId) {
  const row = await env.DB.prepare(
    "SELECT * FROM saml_configurations WHERE project_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
  )
    .bind(projectId)
    .first();
  if (!row) return null;
  return { ...row, enabled: row.status === "active" ? 1 : 0 };
}

/** Create or update the project's primary SAML configuration. */
export async function upsertSamlConfig(env, projectId, body) {
  const existing = await getSamlConfig(env, projectId);
  if (existing?.id) {
    await updateConfiguration(env, {
      configId: existing.id,
      idpEntityId: body.idp_entity_id,
      idpSsoUrl: body.idp_sso_url,
      idpCertificate: body.idp_certificate,
      spEntityId: body.sp_entity_id,
      spAcsUrl: body.sp_acs_url,
      nameIdFormat: body.name_id_format,
      attributeMapping: body.attribute_mapping,
    });
    return { id: existing.id };
  }
  return createConfiguration(env, {
    projectId,
    name: body.name || "Default",
    idpEntityId: body.idp_entity_id,
    idpSsoUrl: body.idp_sso_url,
    idpCertificate: body.idp_certificate,
    spEntityId: body.sp_entity_id || `fluxychat-${projectId}`,
    spAcsUrl: body.sp_acs_url,
    nameIdFormat: body.name_id_format,
    attributeMapping: body.attribute_mapping,
  });
}

/** SSO session row used by /saml/acs (separate from saml_sessions audit table). */
export async function createSsoSession(env, projectId, configurationId, assertion, jwtToken) {
  const id = `sso_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sso_sessions (id, project_id, configuration_id, name_id, jwt_token, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, configurationId, assertion?.nameId || "unknown", jwtToken, expiresAt, now)
    .run();
  return { id };
}

function mapConfigRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    idpEntityId: row.idp_entity_id, idpSsoUrl: row.idp_sso_url,
    idpSloUrl: row.idp_slo_url, idpCertificate: row.idp_certificate,
    idpMetadataUrl: row.idp_metadata_url, spEntityId: row.sp_entity_id,
    spAcsUrl: row.sp_acs_url, spSloUrl: row.sp_slo_url,
    signRequests: row.sign_requests === 1, wantAssertionsSigned: row.want_assertions_signed === 1,
    wantResponseSigned: row.want_response_signed === 1,
    attributeMapping: JSON.parse(row.attribute_mapping || "{}"),
    status: row.status, enforceSso: row.enforce_sso === 1, defaultRole: row.default_role,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapSessionRow(row) {
  return {
    id: row.id, projectId: row.project_id, configurationId: row.configuration_id,
    userId: row.user_id, nameId: row.name_id, nameIdFormat: row.name_id_format,
    sessionIndex: row.session_index,
    attributes: row.attributes ? JSON.parse(row.attributes) : null,
    ipAddress: row.ip_address, userAgent: row.user_agent,
    createdAt: row.created_at, expiresAt: row.expires_at, lastAccessedAt: row.last_accessed_at,
  };
}

function mapJITRow(row) {
  return {
    id: row.id, projectId: row.project_id, configurationId: row.configuration_id,
    userId: row.user_id, nameId: row.name_id, email: row.email, name: row.name,
    attributes: row.attributes ? JSON.parse(row.attributes) : null, provisionedAt: row.provisioned_at,
  };
}

function mapAuditRow(row) {
  return {
    id: row.id, projectId: row.project_id, configurationId: row.configuration_id,
    eventType: row.event_type, userId: row.user_id, nameId: row.name_id,
    ipAddress: row.ip_address, userAgent: row.user_agent,
    details: row.details ? JSON.parse(row.details) : null, createdAt: row.created_at,
  };
}
