CREATE TABLE IF NOT EXISTS huddle_sfu_meter (
  month_utc TEXT PRIMARY KEY,
  bytes_used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS huddle_sfu_open (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  has_video INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_huddle_sfu_open_user
  ON huddle_sfu_open (project_id, room_id, user_id);
