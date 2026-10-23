-- P22-F1 wiring: per-user cross-platform transcripts (dashboard /transcripts and
-- SDK createTranscriptsApi({ worker })). Project-scoped; optional per-entry TTL
-- (expires_at), trimmed to maxPerUser on append.
CREATE TABLE IF NOT EXISTS user_transcripts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_key TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  platform TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  platform_message_id TEXT,
  expires_at INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_transcripts_user
  ON user_transcripts (project_id, user_key, timestamp);
