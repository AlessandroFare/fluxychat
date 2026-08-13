-- Room timeline audit events (approval_chain_updated, approval_requested, etc.)
CREATE TABLE IF NOT EXISTS room_timeline_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_room_timeline_events_room
  ON room_timeline_events (project_id, room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_timeline_events_type
  ON room_timeline_events (project_id, event_type, created_at DESC);
