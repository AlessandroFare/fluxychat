-- P12-C: Unified inbox — room snooze + follow-up flags

CREATE TABLE IF NOT EXISTS inbox_snoozes (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  snooze_until TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_snoozes_until
  ON inbox_snoozes (project_id, user_id, snooze_until);

CREATE TABLE IF NOT EXISTS inbox_follow_ups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER,
  note TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_inbox_follow_ups_open
  ON inbox_follow_ups (project_id, user_id, status, created_at DESC);
