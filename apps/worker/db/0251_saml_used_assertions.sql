-- Audit F-27: SAML assertion replay protection. One row per consumed
-- assertion ID (scope = project), pruned by expires_at + clock skew.
CREATE TABLE IF NOT EXISTS saml_used_assertions (
  id TEXT PRIMARY KEY,            -- "<project_id>|<assertion_id>"
  project_id TEXT NOT NULL,
  assertion_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saml_used_assertions_expires
  ON saml_used_assertions (expires_at);
