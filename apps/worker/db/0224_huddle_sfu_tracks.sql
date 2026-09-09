CREATE TABLE IF NOT EXISTS huddle_sfu_tracks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'audio' CHECK (kind IN ('audio', 'video')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_huddle_sfu_tracks_room
  ON huddle_sfu_tracks (project_id, room_id, created_at);
