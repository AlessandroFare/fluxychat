-- Per-project JWT secrets (HS256) for token verification

CREATE TABLE IF NOT EXISTS project_secrets (
  project_id TEXT PRIMARY KEY,
  jwt_secret TEXT NOT NULL,        -- HS256 shared secret, base64 or hex
  created_at TEXT NOT NULL
);