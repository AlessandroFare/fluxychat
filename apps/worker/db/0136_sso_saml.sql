-- SSO/SAML Authentication
-- P18-A (0081) created simpler saml_configurations / sso_sessions; rename before expanded SAML schema.

ALTER TABLE saml_configurations RENAME TO identity_saml_configurations;
ALTER TABLE sso_sessions RENAME TO identity_sso_sessions;

CREATE TABLE IF NOT EXISTS saml_configurations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  idp_entity_id TEXT NOT NULL,
  idp_sso_url TEXT NOT NULL,
  idp_slo_url TEXT,
  idp_certificate TEXT NOT NULL,
  idp_metadata_url TEXT,
  sp_entity_id TEXT NOT NULL,
  sp_acs_url TEXT NOT NULL,
  sp_slo_url TEXT,
  sp_private_key TEXT,
  sp_certificate TEXT,
  name_id_format TEXT NOT NULL DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  sign_requests INTEGER NOT NULL DEFAULT 1,
  want_assertions_signed INTEGER NOT NULL DEFAULT 1,
  want_response_signed INTEGER NOT NULL DEFAULT 1,
  attribute_mapping TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'testing')),
  enforce_sso INTEGER NOT NULL DEFAULT 0,
  default_role TEXT DEFAULT 'member',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saml_config_project
  ON saml_configurations (project_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saml_config_name
  ON saml_configurations (project_id, name);

CREATE TABLE IF NOT EXISTS saml_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  configuration_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name_id TEXT NOT NULL,
  name_id_format TEXT,
  session_index TEXT,
  attributes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  last_accessed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_saml_session_user
  ON saml_sessions (user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_saml_session_config
  ON saml_sessions (configuration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saml_session_expires
  ON saml_sessions (expires_at);

CREATE TABLE IF NOT EXISTS saml_jit_provisioning (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  configuration_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  attributes TEXT,
  provisioned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saml_jit_project
  ON saml_jit_provisioning (project_id, provisioned_at DESC);
CREATE INDEX IF NOT EXISTS idx_saml_jit_user
  ON saml_jit_provisioning (user_id);

CREATE TABLE IF NOT EXISTS saml_audit_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  configuration_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('login_success', 'login_failure', 'logout', 'session_expired', 'jit_provision', 'config_change', 'certificate_rotate')),
  user_id TEXT,
  name_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saml_audit_project
  ON saml_audit_log (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saml_audit_event
  ON saml_audit_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saml_audit_user
  ON saml_audit_log (user_id, created_at DESC);
