CREATE TABLE IF NOT EXISTS room_edu_timers (
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'timer',
  running INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  accumulated_ms INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, room_id)
);
