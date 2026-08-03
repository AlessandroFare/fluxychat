-- Per-room auto-translate target language (roadmap #4).

CREATE TABLE IF NOT EXISTS room_translation_settings (
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  auto_translate_target TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_translation_settings_project
  ON room_translation_settings (project_id, updated_at DESC);
