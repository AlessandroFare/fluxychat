-- P18-A: Identity & Access (SSO/SAML + SCIM + 2FA)
-- SSO/SAML configurations per project
CREATE TABLE IF NOT EXISTS saml_configurations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  idp_entity_id TEXT NOT NULL,
  idp_sso_url TEXT NOT NULL,
  idp_certificate TEXT NOT NULL,
  sp_entity_id TEXT NOT NULL DEFAULT 'fluxychat',
  sp_acs_url TEXT NOT NULL,
  name_id_format TEXT NOT NULL DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  attribute_mapping TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_saml_configurations_project_id ON saml_configurations(project_id);

-- SSO login sessions (tracks IdP-initiated logins)
CREATE TABLE IF NOT EXISTS sso_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  saml_config_id TEXT NOT NULL,
  name_id TEXT NOT NULL,
  session_index TEXT,
  attributes TEXT NOT NULL DEFAULT '{}',
  jwt_token TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (saml_config_id) REFERENCES saml_configurations(id)
);

CREATE INDEX IF NOT EXISTS idx_sso_sessions_project_id ON sso_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sso_sessions_expires_at ON sso_sessions(expires_at);

-- SCIM provisioning tokens per project
CREATE TABLE IF NOT EXISTS scim_tokens (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  description TEXT,
  scopes TEXT NOT NULL DEFAULT 'users,groups',
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scim_tokens_project_id ON scim_tokens(project_id);

-- SCIM users (synced from IdP)
CREATE TABLE IF NOT EXISTS scim_users (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  user_id TEXT,
  display_name TEXT NOT NULL,
  emails TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  groups TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_scim_users_project_id ON scim_users(project_id);
CREATE INDEX IF NOT EXISTS idx_scim_users_external_id ON scim_users(project_id, external_id);

-- SCIM groups (synced from IdP)
CREATE TABLE IF NOT EXISTS scim_groups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  members TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_scim_groups_project_id ON scim_groups(project_id);

-- Admin 2FA (TOTP) secrets
CREATE TABLE IF NOT EXISTS admin_totp_secrets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  secret TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'SHA1',
  digits INTEGER NOT NULL DEFAULT 6,
  period INTEGER NOT NULL DEFAULT 30,
  enabled INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_totp_secrets_project_user ON admin_totp_secrets(project_id, user_id);

-- Admin 2FA backup codes
CREATE TABLE IF NOT EXISTS admin_totp_backup_codes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_totp_backup_codes_project_user ON admin_totp_backup_codes(project_id, user_id);
