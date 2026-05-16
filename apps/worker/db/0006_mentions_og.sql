-- Mentions and Open Graph preview metadata

CREATE TABLE IF NOT EXISTS message_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  mentioned_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mentions_room_user
  ON message_mentions (project_id, room_id, mentioned_user_id, created_at DESC);

ALTER TABLE messages
  ADD COLUMN mentions TEXT;

ALTER TABLE messages
  ADD COLUMN og_title TEXT;

ALTER TABLE messages
  ADD COLUMN og_description TEXT;

ALTER TABLE messages
  ADD COLUMN og_image TEXT;

ALTER TABLE messages
  ADD COLUMN og_url TEXT;


