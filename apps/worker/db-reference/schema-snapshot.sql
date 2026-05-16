-- Reference snapshot only — NOT applied by `wrangler d1 migrations apply`.
-- Use numbered migrations in ../db/ (0001 … 0031). This file is for local inspection / docs.

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  parent_id INTEGER, -- for threads / replies
  edited_at TEXT,    -- for message edits
  deleted_at TEXT    -- for soft-delete
);

CREATE INDEX IF NOT EXISTS idx_messages_room_created_at
  ON messages (room_id, created_at DESC);

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

CREATE TABLE IF NOT EXISTS moderation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- mute, ban, unban, unmute, flag
  reason TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_room_user
  ON moderation_events (room_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS automation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  room_id TEXT,
  payload TEXT,
  delivered INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Bots and webhooks
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  webhook_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  event_types TEXT NOT NULL, -- comma-separated list of event types
  created_at TEXT NOT NULL
);
