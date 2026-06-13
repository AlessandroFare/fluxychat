/**
 * P18-A: SCIM 2.0 provisioning
 * Lightweight SCIM User/Group CRUD for Okta/Entra/Google sync
 */

const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';

/**
 * Verify SCIM bearer token
 */
export async function verifyScimToken(env, projectId, authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  const tokenHash = await sha256Hex(token);

  const row = await env.DB.prepare(
    `SELECT id, project_id, description, scopes, expires_at
     FROM scim_tokens WHERE project_id = ? AND token_hash = ?`
  )
    .bind(projectId, tokenHash)
    .first();

  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  // Update last_used_at
  await env.DB.prepare(
    `UPDATE scim_tokens SET last_used_at = datetime('now') WHERE id = ?`
  )
    .bind(row.id)
    .run();

  return row;
}

/**
 * Create a SCIM user
 */
export async function createScimUser(env, projectId, data) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const externalId = data.externalId || data.userName;
  const displayName = data.displayName || data.name?.formatted || '';
  const emails = data.emails || (data.userName ? [{ value: data.userName }] : []);
  const active = data.active !== undefined ? (data.active ? 1 : 0) : 1;
  const groups = data.groups || [];

  await env.DB.prepare(
    `INSERT INTO scim_users (id, project_id, external_id, user_id, display_name, emails, active, groups, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      projectId,
      externalId,
      data.id || null,
      displayName,
      JSON.stringify(emails),
      active,
      JSON.stringify(groups),
      JSON.stringify(data.meta || {}),
      now,
      now
    )
    .run();

  return formatScimUser({ id, project_id: projectId, external_id: externalId, user_id: data.id, display_name: displayName, emails: JSON.stringify(emails), active, groups: JSON.stringify(groups), metadata: JSON.stringify(data.meta || {}), created_at: now, updated_at: now });
}

/**
 * Get a SCIM user by external ID or internal ID
 */
export async function getScimUser(env, projectId, userId) {
  const row = await env.DB.prepare(
    `SELECT * FROM scim_users WHERE project_id = ? AND (external_id = ? OR id = ?)`
  )
    .bind(projectId, userId, userId)
    .first();
  return row ? formatScimUser(row) : null;
}

/**
 * List SCIM users with pagination
 */
export async function listScimUsers(env, projectId, startIndex = 1, count = 25) {
  const offset = Math.max(0, startIndex - 1);
  const rows = await env.DB.prepare(
    `SELECT * FROM scim_users WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(projectId, count, offset)
    .all();

  const total = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM scim_users WHERE project_id = ?`
  )
    .bind(projectId)
    .first();

  return {
    schemas: [SCIM_USER_SCHEMA],
    totalResults: total?.cnt || 0,
    startIndex,
    itemsPerPage: count,
    Resources: rows.results.map(formatScimUser),
  };
}

/**
 * Update a SCIM user
 */
export async function updateScimUser(env, projectId, userId, data) {
  const existing = await env.DB.prepare(
    `SELECT * FROM scim_users WHERE project_id = ? AND (external_id = ? OR id = ?)`
  )
    .bind(projectId, userId, userId)
    .first();

  if (!existing) return null;

  const now = new Date().toISOString();
  const displayName = data.displayName || existing.display_name;
  const emails = data.emails ? JSON.stringify(data.emails) : existing.emails;
  const active = data.active !== undefined ? (data.active ? 1 : 0) : existing.active;
  const groups = data.groups ? JSON.stringify(data.groups) : existing.groups;

  await env.DB.prepare(
    `UPDATE scim_users SET display_name = ?, emails = ?, active = ?, groups = ?, updated_at = ? WHERE id = ?`
  )
    .bind(displayName, emails, active, groups, now, existing.id)
    .run();

  return getScimUser(env, projectId, existing.external_id);
}

/**
 * Delete (deactivate) a SCIM user
 */
export async function deleteScimUser(env, projectId, userId) {
  const existing = await env.DB.prepare(
    `SELECT * FROM scim_users WHERE project_id = ? AND (external_id = ? OR id = ?)`
  )
    .bind(projectId, userId, userId)
    .first();

  if (!existing) return false;

  await env.DB.prepare(
    `UPDATE scim_users SET active = 0, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(existing.id)
    .run();

  return true;
}

/**
 * Create a SCIM group
 */
export async function createScimGroup(env, projectId, data) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const externalId = data.externalId || id;
  const displayName = data.displayName || '';
  const members = data.members || [];

  await env.DB.prepare(
    `INSERT INTO scim_groups (id, project_id, external_id, display_name, members, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, externalId, displayName, JSON.stringify(members), now, now)
    .run();

  return formatScimGroup({ id, project_id: projectId, external_id: externalId, display_name: displayName, members: JSON.stringify(members), created_at: now, updated_at: now });
}

/**
 * List SCIM groups
 */
export async function listScimGroups(env, projectId, startIndex = 1, count = 25) {
  const offset = Math.max(0, startIndex - 1);
  const rows = await env.DB.prepare(
    `SELECT * FROM scim_groups WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(projectId, count, offset)
    .all();

  const total = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM scim_groups WHERE project_id = ?`
  )
    .bind(projectId)
    .first();

  return {
    schemas: [SCIM_GROUP_SCHEMA],
    totalResults: total?.cnt || 0,
    startIndex,
    itemsPerPage: count,
    Resources: rows.results.map(formatScimGroup),
  };
}

/**
 * Create a SCIM token
 */
export async function createScimToken(env, projectId, description, scopes) {
  const id = crypto.randomUUID();
  const token = generateScimToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO scim_tokens (id, project_id, token_hash, description, scopes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, tokenHash, description, scopes || 'users,groups', now)
    .run();

  return { id, token, description, created_at: now };
}

/**
 * List SCIM tokens
 */
export async function listScimTokens(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT id, project_id, description, scopes, last_used_at, expires_at, created_at
     FROM scim_tokens WHERE project_id = ? ORDER BY created_at DESC`
  )
    .bind(projectId)
    .all();
  return rows.results;
}

/**
 * Delete a SCIM token
 */
export async function deleteScimToken(env, projectId, tokenId) {
  const result = await env.DB.prepare(
    `DELETE FROM scim_tokens WHERE id = ? AND project_id = ?`
  )
    .bind(tokenId, projectId)
    .run();
  return result.meta?.changes > 0;
}

/**
 * Map SCIM user to FluxyChat user
 */
export function mapScimUserToFluxy(scimUser, attributeMapping = {}) {
  const mapping = {
    userId: attributeMapping.userId || 'user_id',
    email: attributeMapping.email || 'emails',
    name: attributeMapping.name || 'display_name',
    groups: attributeMapping.groups || 'groups',
    ...attributeMapping,
  };

  const attrs = scimUser.attributes || {};
  return {
    userId: resolveAttribute(scimUser, mapping.userId, attrs),
    email: resolveAttribute(scimUser, mapping.email, attrs),
    name: resolveAttribute(scimUser, mapping.name, attrs),
    groups: resolveAttribute(scimUser, mapping.groups, attrs),
  };
}

// --- Helpers ---

function formatScimUser(row) {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: row.external_id || row.id,
    externalId: row.external_id,
    userName: extractEmail(JSON.parse(row.emails || '[]')),
    displayName: row.display_name,
    emails: JSON.parse(row.emails || '[]'),
    active: row.active === 1,
    groups: JSON.parse(row.groups || '[]'),
    meta: {
      resourceType: 'User',
      created: row.created_at,
      lastModified: row.updated_at,
    },
  };
}

function formatScimGroup(row) {
  return {
    schemas: [SCIM_GROUP_SCHEMA],
    id: row.external_id || row.id,
    externalId: row.external_id,
    displayName: row.display_name,
    members: JSON.parse(row.members || '[]'),
    meta: {
      resourceType: 'Group',
      created: row.created_at,
      lastModified: row.updated_at,
    },
  };
}

function extractEmail(emails) {
  if (!Array.isArray(emails) || emails.length === 0) return '';
  const primary = emails.find((e) => e.primary) || emails[0];
  return primary.value || primary;
}

function resolveAttribute(obj, path, attrs) {
  if (path.startsWith('attributes.')) {
    const key = path.slice('attributes.'.length);
    return attrs[key] || obj[key];
  }
  return obj[path] || attrs[path] || null;
}

function generateScimToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
