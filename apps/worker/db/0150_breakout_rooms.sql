-- Breakout rooms: temporary sub-rooms spawned from a parent room.
-- Each breakout has its own DO instance for lifecycle management.
CREATE TABLE IF NOT EXISTS breakout_rooms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closing', 'closed')),
  auto_close_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  closed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_breakout_parent
  ON breakout_rooms (project_id, parent_room_id, status);

CREATE INDEX IF NOT EXISTS idx_breakout_active
  ON breakout_rooms (project_id, status, created_at);
