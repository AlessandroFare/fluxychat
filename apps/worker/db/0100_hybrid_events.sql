-- P20-H: Hybrid Event Mode
CREATE TABLE IF NOT EXISTS hybrid_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  event_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL DEFAULT 'synced',
  venue_url TEXT,
  qr_code TEXT,
  synced_polls INTEGER NOT NULL DEFAULT 1,
  shared_qa INTEGER NOT NULL DEFAULT 1,
  unified_chat INTEGER NOT NULL DEFAULT 1,
  check_in_count INTEGER NOT NULL DEFAULT 0,
  remote_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hybrid_events_room ON hybrid_events(project_id, room_id);

CREATE TABLE IF NOT EXISTS hybrid_checkins (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  checkin_type TEXT NOT NULL DEFAULT 'remote',
  checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_out_at TEXT,
  FOREIGN KEY (event_id) REFERENCES hybrid_events(id)
);

CREATE INDEX IF NOT EXISTS idx_hybrid_checkins_event ON hybrid_checkins(event_id);
