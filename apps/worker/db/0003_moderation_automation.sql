-- Migration: add moderation_events and automation_events tables

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


