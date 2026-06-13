-- P20-G: Streaming Overlays
CREATE TABLE IF NOT EXISTS streaming_overlays (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  overlay_type TEXT NOT NULL DEFAULT 'qa',
  config TEXT NOT NULL DEFAULT '{}',
  style TEXT NOT NULL DEFAULT '{}',
  refresh_seconds INTEGER NOT NULL DEFAULT 30,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_streaming_overlays_room ON streaming_overlays(project_id, room_id);
