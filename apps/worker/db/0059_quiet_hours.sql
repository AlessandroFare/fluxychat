-- P12-N: Quiet hours + batched notifications

CREATE TABLE IF NOT EXISTS user_quiet_hours (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  quiet_start TEXT NOT NULL DEFAULT '22:00',
  quiet_end TEXT NOT NULL DEFAULT '07:00',
  batch_push INTEGER NOT NULL DEFAULT 1,
  batch_in_app INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quiet_hours_enabled
  ON user_quiet_hours (project_id, enabled);

CREATE TABLE IF NOT EXISTS notification_batch_queue (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  room_id TEXT,
  message_id INTEGER,
  payload_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_batch_queue_user
  ON notification_batch_queue (project_id, user_id, created_at ASC);
