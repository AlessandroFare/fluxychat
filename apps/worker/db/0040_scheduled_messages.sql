CREATE TABLE IF NOT EXISTS scheduled_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  send_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  parent_id INTEGER,
  created_at TEXT NOT NULL,
  sent_message_id INTEGER,
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due
  ON scheduled_messages (project_id, room_id, status, send_at);
