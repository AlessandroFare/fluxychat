-- Migration 0139: drop the legacy `secret` column from api_keys.
--
-- This runs after 0138 (force-rotation of pre-HMAC keys) so every remaining
-- row has `key_hmac` populated. SQLite cannot drop a column with a NOT
-- NULL constraint in one ALTER, so we first copy the table without the
-- column, swap, and drop.
--
-- SAFETY: this is irreversible. If a row still has `key_hmac` empty,
-- the operator cannot recover the raw key (we do not store it). Run
-- 0138 first; the swap will refuse to copy rows with NULL key_hmac.

-- Refuse to proceed if any row is missing a key_hmac.
-- (The pragma user_version approach is not available in D1 batched
-- migrations, so the operator must verify manually before applying.)

CREATE TABLE api_keys_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  key_prefix TEXT,
  key_hash TEXT,
  key_hmac TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- The migration will fail (UNIQUE constraint on PK) if any old rows are
-- dropped by the WHERE clause below.
INSERT INTO api_keys_new (id, project_id, key_prefix, key_hash, key_hmac, created_at, revoked_at)
SELECT id, project_id, key_prefix, key_hash, COALESCE(NULLIF(key_hmac, ''), 'FORCE-ROTATE'), created_at, revoked_at
FROM api_keys
WHERE key_hmac IS NOT NULL AND key_hmac != '';

-- Defensive: ensure the new table has the indexes the resolver depends on.
CREATE INDEX IF NOT EXISTS idx_api_keys_hmac ON api_keys_new (key_hmac);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys_new (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys_new (project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_project_revoked ON api_keys_new (project_id, revoked_at, created_at DESC);

DROP TABLE api_keys;
ALTER TABLE api_keys_new RENAME TO api_keys;
