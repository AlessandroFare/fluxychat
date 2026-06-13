-- P15-K: Replay Mode (temporal conversation reconstruction)
CREATE TABLE IF NOT EXISTS replay_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  snapshot_type TEXT NOT NULL DEFAULT 'message',
  event_data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_replay_snapshots_room ON replay_snapshots(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_replay_snapshots_time ON replay_snapshots(timestamp);

CREATE TABLE IF NOT EXISTS replay_bookmarks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  message_id TEXT,
  timestamp TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_replay_bookmarks_room ON replay_bookmarks(project_id, room_id);
