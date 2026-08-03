-- Merge-conflict UI (#48) — ambiguous CRDT/federation edits

CREATE TABLE IF NOT EXISTS message_merge_conflicts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER,
  client_message_id TEXT,
  parent_message_id INTEGER,
  message_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  version_a_json TEXT NOT NULL,
  version_b_json TEXT NOT NULL,
  merged_content TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_message_merge_conflicts_room
  ON message_merge_conflicts (project_id, room_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_merge_conflicts_open_key
  ON message_merge_conflicts (project_id, room_id, message_key)
  WHERE status = 'open';
