-- #46 Empathy Layer — opt-in per-room voice prosody adaptation

CREATE TABLE IF NOT EXISTS room_empathy_settings (
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  min_confidence REAL NOT NULL DEFAULT 0.6,
  escalate_on_stressed INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_empathy_project
  ON room_empathy_settings (project_id);
