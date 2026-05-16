-- Migration: add thread/reaction/read-receipt fields

ALTER TABLE messages
  ADD COLUMN parent_id INTEGER;

ALTER TABLE messages
  ADD COLUMN edited_at TEXT;

ALTER TABLE messages
  ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_parent_id
  ON messages (parent_id);

CREATE TABLE IF NOT EXISTS message_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reactions_message
  ON message_reactions (message_id);

CREATE TABLE IF NOT EXISTS read_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_unique
  ON read_receipts (room_id, user_id, message_id);


