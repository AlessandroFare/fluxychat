-- Attachments and message export support

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  size_bytes INTEGER,
  content_type TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_room
  ON attachments (project_id, room_id, created_at DESC);


