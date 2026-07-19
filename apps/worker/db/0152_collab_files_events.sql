-- FluxyCollab: File Manager + Calendar Events
-- Migration 0152

CREATE TABLE IF NOT EXISTS collab_files (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  mime_type TEXT,
  size_bytes INTEGER DEFAULT 0,
  r2_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_collab_files_room ON collab_files(project_id, room_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_collab_files_created_by ON collab_files(created_by);

CREATE TABLE IF NOT EXISTS collab_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  all_day INTEGER DEFAULT 0,
  color TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_collab_events_room ON collab_events(project_id, room_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_collab_events_time ON collab_events(start_time, end_time);
