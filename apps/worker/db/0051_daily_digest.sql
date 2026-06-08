-- P12-F: Daily AI digest preferences + delivery log (idempotency)

CREATE TABLE IF NOT EXISTS user_digest_preferences (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  email TEXT,
  email_enabled INTEGER NOT NULL DEFAULT 1,
  web_push_enabled INTEGER NOT NULL DEFAULT 1,
  in_app_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_digest_preferences_enabled
  ON user_digest_preferences (project_id, enabled);

CREATE TABLE IF NOT EXISTS digest_deliveries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  digest_date TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  highlights_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_deliveries_dedup
  ON digest_deliveries (project_id, user_id, digest_date, channel);

CREATE INDEX IF NOT EXISTS idx_digest_deliveries_project_date
  ON digest_deliveries (project_id, digest_date);
