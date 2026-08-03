-- Voice Stages (#35) — Discord Stages-style speaker/listener per room

CREATE TABLE IF NOT EXISTS room_voice_stages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  max_speakers INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_voice_stages_project
  ON room_voice_stages (project_id, updated_at DESC);
