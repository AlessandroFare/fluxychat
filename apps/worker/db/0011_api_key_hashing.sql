-- API key security hardening:
-- - store hashed key for lookup
-- - keep key prefix for admin/debug display
-- - support key rotation by adding multiple rows per project

ALTER TABLE api_keys ADD COLUMN key_prefix TEXT;
ALTER TABLE api_keys ADD COLUMN key_hash TEXT;
ALTER TABLE api_keys ADD COLUMN revoked_at TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_hash
  ON api_keys (key_hash);

CREATE INDEX IF NOT EXISTS idx_api_keys_project_revoked
  ON api_keys (project_id, revoked_at, created_at DESC);

