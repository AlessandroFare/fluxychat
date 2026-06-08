-- In-app notifications (mention, dm, system) per user within a project.
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  room_id TEXT,
  message_id INTEGER,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user
  ON in_app_notifications (project_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread
  ON in_app_notifications (project_id, user_id, read_at, created_at DESC);
